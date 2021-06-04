import {Link, Spacer, Text, useToast, Flex, Box} from "@chakra-ui/react";
import {useHistory, useParams} from "react-router-dom";
import React, {useEffect, useState} from "react";
import Neon, {sc, wallet} from "@cityofzion/neon-js";
import {
    DEFAULT_GAS_SCRIPTHASH,
    DEFAULT_GAS_PRECISION,
    DEFAULT_NEO_NETWORK_MAGIC,
    DEFAULT_NEO_RPC_ADDRESS,
    DEFAULT_SC_SCRIPTHASH
} from "../constants";
import {useWalletConnect} from "@cityofzion/wallet-connect-sdk-react";
import {N3Helper} from "../helpers/N3Helper";
import WithdrawModal from "../components/modals/WithdrawModal";
import {ContractParamJson} from "@cityofzion/neon-core/lib/sc";
import {format, formatDuration, intervalToDuration} from 'date-fns';
import Swal, {SweetAlertOptions} from 'sweetalert2'
import SpinnerWithMessage from "../components/SpinnerWithMessage";
import {Stream} from "../types/Stream";

export default function StreamDetails() {
    const walletConnectCtx = useWalletConnect()
    let {id} = useParams<{ id: string }>();
    const toast = useToast()
    const history = useHistory()
    const [loading, setLoading] = useState<string | null>('Retrieving Stream')
    const [withdrawOpen, setWithdrawOpen] = useState(false)
    const [stream, setStream] = useState<Stream | undefined>(undefined)
    const [countdown, setCountdown] = useState<string | undefined>(undefined)

    const n3Helper = new N3Helper(DEFAULT_NEO_RPC_ADDRESS, DEFAULT_NEO_NETWORK_MAGIC)

    const loadStream = async () => {
        const contract = new Neon.experimental.SmartContract(
            Neon.u.HexString.fromHex(DEFAULT_SC_SCRIPTHASH),
            {
                networkMagic: DEFAULT_NEO_NETWORK_MAGIC,
                rpcAddress: DEFAULT_NEO_RPC_ADDRESS
            }
        );

        let resp
        try {
            resp = await contract.testInvoke('getStream', [sc.ContractParam.integer(Number(id))])
        } catch (e) {
            resp = {error: {message: e.message, ...e}}
        }

        try {
            const retrievedStream = JSON.parse(atob(resp.stack?.[0].value as string))
            setStream(retrievedStream)
        } catch (e) {
            toast({
                title: "Stream not found",
                status: "error",
                duration: 10000,
                isClosable: true,
            })
            history.push("/")
        }
        setLoading(null)
    }

    useEffect(() => {
        loadStream()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        updateCountDown()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stream, countdown])

    const withdrawnValue = () => {
        if (stream) {
            return stream.deposit - stream.remaining
        }
        return 0
    }

    const withdrawnPct = () => {
        if (stream) {
            return withdrawnValue() / stream.deposit
        }
        return 0
    }

    const withdrawnPctFormatted = () => {
        return (withdrawnPct() * 100).toFixed(1) + '%'
    }

    const startFormatted = () => {
        if (stream) {
            return format(stream.start, 'yyyy/MM/dd HH:mm:ss')
        }
        return ''
    }

    const endFormatted = () => {
        if (stream) {
            return format(stream.stop, 'yyyy/MM/dd HH:mm:ss')
        }
        return ''
    }

    const streamedPct = () => {
        if (stream) {
            const passedTime = new Date().getTime() - stream.start
            const totalTime = stream.stop - stream.start
            return Math.max(0, (Math.min(1, passedTime / totalTime)))
        }
        return 0
    }

    const streamedPctFormatted = () => {
        return (streamedPct() * 100).toFixed(1) + '%'
    }

    const streamedValue = () => {
        if (stream) {
            return streamedPct() * stream.deposit
        }
        return 0
    }

    const updateCountDown = async () => {
        if (stream?.stop) {
            await sleep(1000)
            const now = new Date().getTime()
            if (now < stream.stop) {
                setCountdown(
                    formatDuration(
                        intervalToDuration({
                            start: now,
                            end: stream.stop
                        })
                    )
                )
            } else {
                setCountdown("Stream completed")
            }
        }
    }

    const sleep = (time: number) => {
        return new Promise(resolve => {
            setTimeout(resolve, time)
        })
    }

    const share = async () => {
        await navigator.share({
            title: 'CryptSydra',
            text: 'Streaming Payments for NEO N3',
            url: window.location.href
        })
    }

    const withdraw = async (amountToWithdraw: number) => {
        setWithdrawOpen(false)
        if (amountToWithdraw <= 0) return
        amountToWithdraw = amountToWithdraw * DEFAULT_GAS_PRECISION

        const streamId = {type: 'Integer', value: Number(id)}
        const value = {type: 'Integer', value: amountToWithdraw}

        const resp = await walletConnectCtx.invokeFunction(DEFAULT_SC_SCRIPTHASH, 'withdraw', [streamId, value])

        if (resp.result.error && resp.result.error.message) {
            toast({
                title: resp.result.error.message,
                status: "error",
                duration: 10000,
                isClosable: true,
            })
            return
        }

        setLoading('Validating Result')
        const notification = (await n3Helper.getNotificationsFromTxId(resp.result))
            .find(n => n.contract === DEFAULT_GAS_SCRIPTHASH && n.eventname === 'Transfer')
        if (!notification) return
        const notificationValues = notification.state.value as ContractParamJson[]
        if (!notificationValues || notificationValues.length < 3) return
        const recipient = wallet.getAddressFromScriptHash(Neon.u.base642hex(notificationValues[1].value as string))
        const amount = (Number(notificationValues[2].value) / DEFAULT_GAS_PRECISION).toFixed(8)

        toast({
            title: "Success!",
            description: `${amount} GAS was sent to ${recipient}`,
            status: "success",
            duration: 4000,
            isClosable: true,
        })

        await loadStream()
        setLoading(null)
    }

    const dialog = (options: SweetAlertOptions) => {
        return new Promise((resolve, reject) => {
            Swal.fire(options).then((result) => {
                if (result.isConfirmed) {
                    resolve(result)
                } else {
                    reject(result)
                }
            })
        })
    }

    const cancelStream = async () => {
        await dialog({
            title: 'Are you sure?',
            text: 'The Gas that was not Streamed will return to Sender\'s Account',
            showCancelButton: true,
        })

        const streamId = {type: 'Integer', value: Number(id)}

        const resp = await walletConnectCtx.invokeFunction(DEFAULT_SC_SCRIPTHASH, 'cancelStream', [streamId])

        if (resp.result.error && resp.result.error.message) {
            toast({
                title: resp.result.error.message,
                status: "error",
                duration: 10000,
                isClosable: true,
            })
            return
        }

        setLoading('Validating Result')
        const notification = (await n3Helper.getNotificationsFromTxId(resp.result))
            .find(n => n.contract === DEFAULT_SC_SCRIPTHASH && n.eventname === 'StreamCanceled')
        if (!notification) return

        toast({
            title: "Success!",
            description: `Stream cancelled`,
            status: "success",
            duration: 4000,
            isClosable: true,
        })

        setLoading(null)
        history.push("/")
    }

    return (<>
        {loading ? <><Spacer/><SpinnerWithMessage xl={true} message={loading} /><Spacer/></> : (<>
            <Spacer/>
            <Flex direction="column" w="100%" maxW="60rem" fontWeight="bold" fontSize="0.875rem" color="#004e87" px="0.5rem">
                <Flex mb="0.5rem">
                    <Flex direction="column">
                        <Text fontSize="1.5rem">{(withdrawnValue() / DEFAULT_GAS_PRECISION).toFixed(8)}</Text>
                        <Text>Gas Withdrawn</Text>
                    </Flex>
                    <Spacer/>
                    <Flex direction="column" textAlign="center">
                        <Text fontSize="1.5rem">{(streamedValue() / DEFAULT_GAS_PRECISION).toFixed(8)}</Text>
                        <Text>Gas Streamed</Text>
                    </Flex>
                    <Spacer/>
                    <Flex direction="column" textAlign="right">
                        <Text fontSize="1.5rem">{((stream?.deposit ?? 0) / DEFAULT_GAS_PRECISION).toFixed(8)}</Text>
                        <Text>Gas Total</Text>
                    </Flex>
                </Flex>
                <Box bg="white" h="3rem" borderRadius="6.25rem" overflow="hidden">
                    <Text bg="#0094ff" w={streamedPctFormatted()} h="3rem" lineHeight="3rem" borderRadius="6.25rem"
                          textAlign="right" pr="0.8rem">
                        {streamedPct() > 0 && streamedPctFormatted()}
                    </Text>
                    <Text bg="#004e87" w={withdrawnPctFormatted()} h="3rem" lineHeight="3rem" borderRadius="6.25rem"
                          textAlign="right" pr="0.8rem" color="white" mt="-3rem">
                        {withdrawnPct() > 0 && withdrawnPctFormatted()}
                    </Text>
                </Box>
                <Flex mt="0.5rem">
                    <Text>Started at {startFormatted()}</Text>
                    <Spacer/>
                    <Text textAlign="right">Ends at {endFormatted()}</Text>
                </Flex>
            </Flex>
            <Spacer/>
            <Text color="#004e87" fontSize="2rem" fontWeight="bold" textAlign="center" mx="1rem">{countdown}</Text>
            <Spacer/>
            <Flex direction="column" w="100%" maxW="26rem" px="1rem">
                <Link onClick={() => setWithdrawOpen(true)} color="white" bg="#0094ff" mb="1rem"
                      p={["0.4rem", "0.6rem"]}
                      textAlign="center"
                      _hover={{textDecoration: 'none', backgroundColor: '#0081dc'}}>
                    <Text fontSize="1.6rem" m={0}>Withdraw</Text>
                </Link>
                <Flex>
                    <Link onClick={share} color="white" bg="#004e87" mr="1rem"
                          flex="1" p={["0.4rem", "0.6rem"]}
                          textAlign="center"
                          _hover={{textDecoration: 'none', backgroundColor: '#0081dc'}}>
                        <Text fontSize="1.6rem" m={0}>Share</Text>
                    </Link>
                    <Link onClick={cancelStream} color="white" bg="#004e87"
                          flex="1" w="12rem" p={["0.4rem", "0.6rem"]}
                          textAlign="center"
                          _hover={{textDecoration: 'none', backgroundColor: '#550033'}}>
                        <Text fontSize="1.6rem" m={0}>Cancel Stream</Text>
                    </Link>
                </Flex>
            </Flex>
            <Spacer/>
            <WithdrawModal isOpen={withdrawOpen} onClose={withdraw}/>
        </>)}
    </>)
}
