import * as React from "react";

import Loader from "../Loader";

import {useWalletConnect} from "@cityofzion/wallet-connect-sdk-react";
import {
    Flex,
    Text,
    ModalBody,
    ModalCloseButton,
    ModalHeader,
    ModalOverlay,
    ModalContent,
    Modal
} from "@chakra-ui/react";

export default function RequestModal() {
  const walletConnectCtx = useWalletConnect()

  const handleClose = () => {
      walletConnectCtx.setIsPendingApproval(false)
  }

  return (
      <Modal isOpen={!!walletConnectCtx.isPendingApproval} onClose={handleClose}>
          <ModalOverlay/>
          <ModalContent>
              <ModalHeader>{"Pending JSON-RPC Request"}</ModalHeader>
              <ModalCloseButton/>
              <ModalBody>
                  <Flex direction="column" align="center">
                    <Loader />
                    <Text fontWeight="bold" my="2rem">Approve or reject request using your wallet</Text>
                  </Flex>
              </ModalBody>
          </ModalContent>
      </Modal>
  )
};
