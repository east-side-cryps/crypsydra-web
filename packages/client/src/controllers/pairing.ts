import { EventEmitter } from "events";
import { Logger } from "pino";
import { generateChildLogger } from "@pedrouid/pino-utils";
import {
  PairingTypes,
  IClient,
  IPairing,
  SubscriptionEvent,
  CryptoTypes,
} from "@walletconnect/types";
import {
  deriveSharedKey,
  generateKeyPair,
  generateRandomBytes32,
  isPairingFailed,
  mapEntries,
  sha256,
  isPairingResponded,
  formatUri,
  isSubscriptionUpdatedEvent,
} from "@walletconnect/utils";
import {
  JsonRpcPayload,
  JsonRpcRequest,
  JsonRpcResponse,
  formatJsonRpcError,
  formatJsonRpcRequest,
  formatJsonRpcResult,
  isJsonRpcError,
  isJsonRpcRequest,
} from "@json-rpc-tools/utils";

import { Subscription } from "./subscription";
import {
  PAIRING_CONTEXT,
  PAIRING_EVENTS,
  PAIRING_JSONRPC,
  PAIRING_REASONS,
  PAIRING_STATUS,
  SUBSCRIPTION_EVENTS,
  RELAY_DEFAULT_PROTOCOL,
  PAIRING_SIGNAL_METHOD_URI,
  SESSION_JSONRPC,
  PAIRING_DEFAULT_TTL,
} from "../constants";

export class Pairing extends IPairing {
  public pending: Subscription<PairingTypes.Pending>;
  public settled: Subscription<PairingTypes.Settled>;

  public events = new EventEmitter();

  protected context: string = PAIRING_CONTEXT;

  constructor(public client: IClient, public logger: Logger) {
    super(client, logger);
    this.logger = generateChildLogger(logger, this.context);
    this.pending = new Subscription<PairingTypes.Pending>(
      client,
      this.logger,
      PAIRING_STATUS.pending,
      false,
    );
    this.settled = new Subscription<PairingTypes.Settled>(
      client,
      this.logger,
      PAIRING_STATUS.settled,
      true,
    );
    this.registerEventListeners();
  }

  public async init(): Promise<void> {
    this.logger.trace(`Initialized`);
    await this.pending.init();
    await this.settled.init();
  }

  public async get(topic: string): Promise<PairingTypes.Settled> {
    return this.settled.get(topic);
  }

  public async send(topic: string, payload: JsonRpcPayload): Promise<void> {
    const pairing = await this.settled.get(topic);
    const encryptKeys: CryptoTypes.EncryptKeys = {
      sharedKey: pairing.sharedKey,
      publicKey: pairing.self.publicKey,
    };
    if (isJsonRpcRequest(payload) && !Object.values(PAIRING_JSONRPC).includes(payload.method)) {
      if (!pairing.permissions.jsonrpc.methods.includes(payload.method)) {
        const errorMessage = `Unauthorized JSON-RPC Method Requested: ${payload.method}`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
      }
      payload = formatJsonRpcRequest<PairingTypes.Payload>(PAIRING_JSONRPC.payload, {
        payload,
      });
    }
    this.client.relay.publish(pairing.topic, payload, { relay: pairing.relay, encryptKeys });
  }

  get length(): number {
    return this.settled.length;
  }

  get entries(): Record<string, PairingTypes.Settled> {
    return mapEntries(this.settled.entries, x => x.data);
  }

  public async create(params?: PairingTypes.CreateParams): Promise<PairingTypes.Settled> {
    this.logger.debug(`Create Pairing`);
    this.logger.trace({ type: "method", method: "create", params });
    return new Promise(async (resolve, reject) => {
      const pending = await this.propose(params);
      this.pending.on(
        SUBSCRIPTION_EVENTS.updated,
        async (updatedEvent: SubscriptionEvent.Updated<PairingTypes.Pending>) => {
          if (pending.topic !== updatedEvent.data.topic) return;
          if (isPairingResponded(updatedEvent.data)) {
            const outcome = updatedEvent.data.outcome;
            if (isPairingFailed(outcome)) {
              await this.pending.delete(pending.topic, outcome.reason);
              reject(new Error(outcome.reason));
            } else {
              const pairing = await this.settled.get(outcome.topic);
              await this.pending.delete(pending.topic, PAIRING_REASONS.settled);
              resolve(pairing);
            }
          }
        },
      );
    });
  }

  public async respond(params: PairingTypes.RespondParams): Promise<PairingTypes.Pending> {
    this.logger.debug(`Respond Pairing`);
    this.logger.trace({ type: "method", method: "respond", params });
    const { approved, proposal } = params;
    const self = generateKeyPair();
    if (approved) {
      try {
        const responder: PairingTypes.Peer = {
          publicKey: self.publicKey,
        };
        const expiry = Date.now() + proposal.ttl;
        const pairing = await this.settle({
          relay: proposal.relay,
          self,
          peer: proposal.proposer,
          permissions: proposal.permissions,
          ttl: proposal.ttl,
          expiry,
        });
        const outcome: PairingTypes.Outcome = {
          topic: pairing.topic,
          relay: pairing.relay,
          responder,
          expiry,
        };
        const pending: PairingTypes.Pending = {
          status: PAIRING_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      } catch (e) {
        const reason = e.message;
        const outcome: PairingTypes.Outcome = { reason };
        const pending: PairingTypes.Pending = {
          status: PAIRING_STATUS.responded,
          topic: proposal.topic,
          relay: proposal.relay,
          self,
          proposal,
          outcome,
        };
        await this.pending.set(pending.topic, pending, { relay: pending.relay });
        return pending;
      }
    } else {
      const outcome: PairingTypes.Outcome = { reason: PAIRING_REASONS.not_approved };
      const pending: PairingTypes.Pending = {
        status: PAIRING_STATUS.responded,
        topic: proposal.topic,
        relay: proposal.relay,
        self,
        proposal,
        outcome,
      };
      await this.pending.set(pending.topic, pending, { relay: pending.relay });
      return pending;
    }
  }

  public async update(params: PairingTypes.UpdateParams): Promise<PairingTypes.Settled> {
    this.logger.debug(`Update Pairing`);
    this.logger.trace({ type: "method", method: "update", params });
    const pairing = await this.settled.get(params.topic);
    const participant: CryptoTypes.Participant = { publicKey: pairing.self.publicKey };
    const update = await this.handleUpdate(pairing, params, participant);
    const request = formatJsonRpcRequest(PAIRING_JSONRPC.update, update);
    this.send(pairing.topic, request);
    return pairing;
  }

  public async delete(params: PairingTypes.DeleteParams): Promise<void> {
    this.logger.debug(`Delete Pairing`);
    this.logger.trace({ type: "method", method: "delete", params });
    await this.settled.delete(params.topic, params.reason);
  }

  public on(event: string, listener: any): void {
    this.events.on(event, listener);
  }

  public once(event: string, listener: any): void {
    this.events.once(event, listener);
  }

  public off(event: string, listener: any): void {
    this.events.off(event, listener);
  }

  public removeListener(event: string, listener: any): void {
    this.events.removeListener(event, listener);
  }

  // ---------- Protected ----------------------------------------------- //

  protected async propose(params?: PairingTypes.ProposeParams): Promise<PairingTypes.Pending> {
    this.logger.debug(`Propose Pairing`);
    this.logger.trace({ type: "method", method: "propose", params });
    const relay = params?.relay || { protocol: RELAY_DEFAULT_PROTOCOL };
    const topic = generateRandomBytes32();
    const self = generateKeyPair();
    const proposer: PairingTypes.Peer = {
      publicKey: self.publicKey,
    };
    const uri = formatUri({
      protocol: this.client.protocol,
      version: this.client.version,
      topic: topic,
      publicKey: proposer.publicKey,
      relay: relay,
    });
    const permissions: PairingTypes.Permissions = {
      jsonrpc: {
        methods: [SESSION_JSONRPC.propose],
      },
    };
    const proposal: PairingTypes.Proposal = {
      relay,
      topic,
      proposer,
      signal: {
        method: PAIRING_SIGNAL_METHOD_URI,
        params: { uri },
      },
      permissions,
      ttl: PAIRING_DEFAULT_TTL,
    };
    const pending: PairingTypes.Pending = {
      status: PAIRING_STATUS.proposed,
      topic: proposal.topic,
      relay: proposal.relay,
      self,
      proposal,
    };
    await this.pending.set(pending.topic, pending, { relay });
    return pending;
  }

  protected async settle(params: PairingTypes.SettleParams): Promise<PairingTypes.Settled> {
    this.logger.debug(`Settle Pairing`);
    this.logger.trace({ type: "method", method: "settle", params });
    const sharedKey = deriveSharedKey(params.self.privateKey, params.peer.publicKey);
    const topic = await sha256(sharedKey);
    const pairing: PairingTypes.Settled = {
      topic,
      relay: params.relay,
      sharedKey,
      self: params.self,
      peer: params.peer,
      permissions: params.permissions,
      expiry: params.expiry,
    };
    const decryptKeys: CryptoTypes.DecryptKeys = {
      sharedKey,
    };
    await this.settled.set(pairing.topic, pairing, { relay: pairing.relay, decryptKeys });
    return pairing;
  }

  protected async onResponse(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Pairing response`);
    this.logger.trace({ type: "method", method: "onResponse", topic, payload });
    const request = payload as JsonRpcRequest<PairingTypes.Outcome>;
    const pending = await this.pending.get(topic);
    let errorMessage: string | undefined;
    if (!isPairingFailed(request.params)) {
      try {
        const pairing = await this.settle({
          relay: pending.relay,
          self: pending.self,
          peer: request.params.responder,
          permissions: pending.proposal.permissions,
          ttl: pending.proposal.ttl,
          expiry: request.params.expiry,
        });
        await this.pending.update(topic, {
          status: PAIRING_STATUS.responded,
          outcome: {
            topic: pairing.topic,
            relay: pairing.relay,
            responder: request.params.responder,
            expiry: pairing.expiry,
          },
        });
      } catch (e) {
        this.logger.error(e);
        errorMessage = e.message;
        await this.pending.update(topic, {
          status: PAIRING_STATUS.responded,
          outcome: { reason: e.message },
        });
      }
      const response =
        typeof errorMessage === "undefined"
          ? formatJsonRpcResult(request.id, true)
          : formatJsonRpcError(request.id, errorMessage);
      this.client.relay.publish(pending.topic, response, { relay: pending.relay });
    } else {
      this.logger.error(request.params.reason);
      await this.pending.update(topic, {
        status: PAIRING_STATUS.responded,
        outcome: { reason: request.params.reason },
      });
    }
  }

  protected async onAcknowledge(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Pairing acknowledge`);
    this.logger.trace({ type: "method", method: "onAcknowledge", topic, payload });
    const response = payload as JsonRpcResponse;
    const pending = await this.pending.get(topic);
    if (!isPairingResponded(pending)) return;
    if (isJsonRpcError(response) && !isPairingFailed(pending.outcome)) {
      await this.settled.delete(pending.outcome.topic, response.error.message);
    }
    await this.pending.delete(topic, PAIRING_REASONS.acknowledged);
  }

  protected async onMessage(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Pairing message`);
    this.logger.trace({ type: "method", method: "onMessage", topic, payload });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const pairing = await this.settled.get(payloadEvent.topic);
      let errorMessage = "";
      switch (request.method) {
        case PAIRING_JSONRPC.payload:
          await this.onPayload(payloadEvent);
          break;
        case PAIRING_JSONRPC.update:
          await this.onUpdate(payloadEvent);
          break;
        case PAIRING_JSONRPC.delete:
          await this.settled.delete(pairing.topic, request.params.reason);
          break;
        default:
          errorMessage = `Unknown JSON-RPC Method Requested: ${request.method}`;
          this.logger.error(errorMessage);
          this.send(pairing.topic, formatJsonRpcError(request.id, errorMessage));
          break;
      }
    } else {
      this.onPayloadEvent(payloadEvent);
    }
  }

  protected async onPayload(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic } = payloadEvent;
    const request = payloadEvent.payload as JsonRpcRequest<PairingTypes.Payload>;
    const { payload } = request.params;
    const pairingPayloadEvent: PairingTypes.PayloadEvent = { topic, payload };
    this.logger.debug(`Receiving Pairing payload`);
    this.logger.trace({ type: "method", method: "onPayload", ...pairingPayloadEvent });
    if (isJsonRpcRequest(payload)) {
      const request = payload as JsonRpcRequest;
      const pairing = await this.settled.get(topic);
      if (!pairing.permissions.jsonrpc.methods.includes(request.method)) {
        const errorMessage = `Unauthorized JSON-RPC Method Requested: ${request.method}`;
        this.logger.error(errorMessage);
        this.send(pairing.topic, formatJsonRpcError(request.id, errorMessage));
        return;
      }
      this.onPayloadEvent(pairingPayloadEvent);
    } else {
      this.onPayloadEvent(pairingPayloadEvent);
    }
  }

  protected async onUpdate(payloadEvent: SubscriptionEvent.Payload): Promise<void> {
    const { topic, payload } = payloadEvent;
    this.logger.debug(`Receiving Pairing update`);
    this.logger.trace({ type: "method", method: "onUpdate", topic, payload });
    const request = payloadEvent.payload as JsonRpcRequest;
    const pairing = await this.settled.get(payloadEvent.topic);
    try {
      const participant: CryptoTypes.Participant = { publicKey: pairing.peer.publicKey };
      await this.handleUpdate(pairing, { topic, update: request.params }, participant);
      const response = formatJsonRpcResult(request.id, true);
      this.send(pairing.topic, response);
    } catch (e) {
      this.logger.error(e);
      const response = formatJsonRpcError(request.id, e.message);
      this.send(pairing.topic, response);
    }
  }

  protected async handleUpdate(
    pairing: PairingTypes.Settled,
    params: PairingTypes.UpdateParams,
    participant: { publicKey: string },
  ): Promise<PairingTypes.Update> {
    let update: PairingTypes.Update;
    if (typeof params.update.peer !== "undefined") {
      const metadata = params.update.peer.metadata as PairingTypes.Metadata;
      if (pairing.peer.publicKey === participant.publicKey) {
        pairing.peer.metadata = metadata;
      }
      update = { peer: { metadata } };
    } else {
      const errorMessage = `Invalid ${this.context} update request params`;
      this.logger.error(errorMessage);
      throw new Error(errorMessage);
    }
    await this.settled.update(pairing.topic, pairing);
    return update;
  }

  // ---------- Private ----------------------------------------------- //

  private async onPayloadEvent(payloadEvent: PairingTypes.PayloadEvent) {
    this.logger.info(`Emitting ${PAIRING_EVENTS.payload}`);
    this.logger.debug({ type: "event", event: PAIRING_EVENTS.payload, data: payloadEvent });
    this.events.emit(PAIRING_EVENTS.payload, payloadEvent);
  }

  private async onPendingPayloadEvent(event: SubscriptionEvent.Payload) {
    if (isJsonRpcRequest(event.payload)) {
      if (event.payload.method === PAIRING_JSONRPC.respond) {
        this.onResponse(event);
      }
    } else {
      this.onAcknowledge(event);
    }
  }

  private async onPendingStatusEvent(
    event:
      | SubscriptionEvent.Created<PairingTypes.Pending>
      | SubscriptionEvent.Updated<PairingTypes.Pending>,
  ) {
    const pending = event.data;
    if (isPairingResponded(pending)) {
      this.logger.info(`Emitting ${PAIRING_EVENTS.responded}`);
      this.logger.debug({ type: "event", event: PAIRING_EVENTS.responded, data: pending });
      this.events.emit(PAIRING_EVENTS.responded, pending);
      if (!isSubscriptionUpdatedEvent(event)) {
        const request = formatJsonRpcRequest(PAIRING_JSONRPC.respond, pending.outcome);
        this.client.relay.publish(pending.topic, request, { relay: pending.relay });
      }
    } else {
      this.logger.info(`Emitting ${PAIRING_EVENTS.proposed}`);
      this.logger.debug({ type: "event", event: PAIRING_EVENTS.proposed, data: pending });
      this.events.emit(PAIRING_EVENTS.proposed, pending);
    }
  }

  private registerEventListeners(): void {
    // Pending Subscription Events
    this.pending.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onPendingPayloadEvent(payloadEvent),
    );
    this.pending.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<PairingTypes.Pending>) =>
        this.onPendingStatusEvent(createdEvent),
    );
    this.pending.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<PairingTypes.Pending>) =>
        this.onPendingStatusEvent(updatedEvent),
    );
    // Settled Subscription Events
    this.settled.on(SUBSCRIPTION_EVENTS.payload, (payloadEvent: SubscriptionEvent.Payload) =>
      this.onMessage(payloadEvent),
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.created,
      (createdEvent: SubscriptionEvent.Created<PairingTypes.Settled>) => {
        const pairing = createdEvent.data;
        this.logger.info(`Emitting ${PAIRING_EVENTS.settled}`);
        this.logger.debug({ type: "event", event: PAIRING_EVENTS.settled, data: pairing });
        this.events.emit(PAIRING_EVENTS.settled, pairing);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.updated,
      (updatedEvent: SubscriptionEvent.Updated<PairingTypes.Settled>) => {
        const pairing = updatedEvent.data;
        this.logger.info(`Emitting ${PAIRING_EVENTS.updated}`);
        this.logger.debug({ type: "event", event: PAIRING_EVENTS.updated, data: pairing });
        this.events.emit(PAIRING_EVENTS.updated, pairing);
      },
    );
    this.settled.on(
      SUBSCRIPTION_EVENTS.deleted,
      (deletedEvent: SubscriptionEvent.Deleted<PairingTypes.Settled>) => {
        const pairing = deletedEvent.data;
        this.logger.info(`Emitting ${PAIRING_EVENTS.deleted}`);
        this.logger.debug({ type: "event", event: PAIRING_EVENTS.deleted, data: pairing });
        this.events.emit(PAIRING_EVENTS.deleted, pairing);
        const request = formatJsonRpcRequest(PAIRING_JSONRPC.delete, {
          reason: deletedEvent.reason,
        });
        this.client.relay.publish(pairing.topic, request, { relay: pairing.relay });
      },
    );
  }
}