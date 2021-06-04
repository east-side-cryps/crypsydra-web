import {Box, Flex, HStack, Spacer, Text, VStack} from "@chakra-ui/react";
import RadioIcon from "../components/icons/RadioIcon";
import {Link} from "react-router-dom"
import Neon, {sc} from "@cityofzion/neon-js";
import {DEFAULT_NEO_NETWORK_MAGIC, DEFAULT_NEO_RPC_ADDRESS, DEFAULT_SC_SCRIPTHASH} from "../constants";
import React, {useEffect, useState} from "react";
import {useWalletConnect} from "@cityofzion/wallet-connect-sdk-react";
import SpinnerWithMessage from "../components/SpinnerWithMessage";
import {Stream} from "../types/Stream";
import LiStream from "../components/LiStream";

export default function Home() {
    const walletConnectCtx = useWalletConnect()
    const [loadingMyStreams, setLoadingMyStreams] = useState(false)
    const [senderStreams, setSenderStream] = useState<Stream[]>([])
    const [recipientStreams, setRecipientStream] = useState<Stream[]>([])

    const contract = new Neon.experimental.SmartContract(
        Neon.u.HexString.fromHex(DEFAULT_SC_SCRIPTHASH),
        {
            networkMagic: DEFAULT_NEO_NETWORK_MAGIC,
            rpcAddress: DEFAULT_NEO_RPC_ADDRESS
        }
    );

    useEffect(() => {
        loadMyStreams()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletConnectCtx, walletConnectCtx.accounts])

    const loadMyStreams = async () => {
        if (!walletConnectCtx.accounts[0] || loadingMyStreams) return
        const [address] = walletConnectCtx.accounts[0].split("@");

        setLoadingMyStreams(true)
        setSenderStream([])
        setRecipientStream([])

        await loadGenericList(address, 'getSenderStreams', setSenderStream)
        await loadGenericList(address, 'getRecipientStreams', setRecipientStream)

        setLoadingMyStreams(false)
    }

    const loadGenericList = async (address: string, method: string, setter: React.Dispatch<React.SetStateAction<Stream[]>>) => {
        try {
            const resp = await contract.testInvoke(method, [sc.ContractParam.hash160(address)])
            const retrievedStreams: number[] = JSON.parse(atob(resp.stack?.[0].value as string))
            for (const id of retrievedStreams) {
                const stream = await loadStream(id)
                if (stream != null) {
                    setter((old) => [...old, stream])
                }
            }
        } catch (e) {
        }
    }

    const loadStream = async (id: number) => {
        let resp
        try {
            resp = await contract.testInvoke('getStream', [sc.ContractParam.integer(id)])
            return JSON.parse(atob(resp.stack?.[0].value as string))
        } catch (e) {
            return null
        }
    }

    return (<>
        <Spacer/>
        <Text maxW="44rem" color="#004e87" fontSize={["1.4rem", "2rem"]} textAlign="center"
              fontWeight="bold" m="0.5rem" my="1rem">
            If you want to securely pay someone a little bit at a time, Crypsydra is for you
        </Text>
        <Spacer/>
        <Box bg="#0094ff" m="0.5rem"
             _hover={{textDecoration: 'none', backgroundColor: '#0081dc'}}>
            <Link to="/createStream">
                <Flex align="center" p={["0.5rem 1rem", "1rem 2rem"]}>
                    <RadioIcon color="white" boxSize="2.5rem" mr="1rem"/>
                    <Text color="white" fontSize="2rem">Create a Stream</Text>
                </Flex>
            </Link>
        </Box>
        <Spacer/>
        {loadingMyStreams && <SpinnerWithMessage xl={false} message="Loading Your Streams"></SpinnerWithMessage>}

        {(senderStreams.length > 0 || recipientStreams.length > 0) && (<>
            <Text color="#004e87" fontWeight="bold" fontSize="2rem" mt="1rem">My Streams</Text>
            <HStack my="2rem" spacing="0.75rem">
                {!!senderStreams.length && (
                    <VStack alignSelf="start" spacing="0.75rem" w="26rem">
                        <Text textTransform="uppercase" fontSize="1rem" color="#004e87">As Sender</Text>
                        {senderStreams.map(s => <LiStream key={s.id} stream={s} />)}
                    </VStack>
                )}
                {!!recipientStreams.length && (
                    <VStack alignSelf="start" spacing="0.75rem" w="26rem">
                        <Text textTransform="uppercase" fontSize="1rem" color="#004e87">As Recipient</Text>
                        {recipientStreams.map(s => <LiStream key={s.id} stream={s} />)}
                    </VStack>
                )}
            </HStack>
        </>)}
        <Spacer/>
    </>)
}