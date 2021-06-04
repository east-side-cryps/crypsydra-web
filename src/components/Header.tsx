import * as React from "react";
import {Flex, Image, Link, Spacer, Spinner, Text, useToast} from "@chakra-ui/react";
import {useWalletConnect} from "@cityofzion/wallet-connect-sdk-react";
import {matchPath, useLocation, Link as RLink} from "react-router-dom";
import CopyIcon from "./icons/CopyIcon";
import copy from "clipboard-copy";
import {useEffect, useState} from "react";
import LogoutIcon from "./icons/LogoutIcon";

const chainMeta = {
    name: 'Neo3',
    logo: 'https://cryptologos.cc/logos/neo-neo-logo.svg',
}

export default function Header() {
    const walletConnectCtx = useWalletConnect()
    let location = useLocation()
    const toast = useToast()
    const [id, setId] = useState<string | undefined>(undefined)

    useEffect(() => {
        const path = matchPath<{ id: string | undefined }>(location.pathname, {path: '/stream/:id'})
        setId(path?.params.id)
    }, [location])

    const copyUrl = () => {
        copy(window.location.href)

        toast({
            title: "URL copied to clipboard",
            status: "success",
            duration: 2000,
            isClosable: true,
        })
    }

    const ellipseAddress = (address = "", width = 10) => {
        return `${address.slice(0, width)}...${address.slice(-width)}`;
    }

    return (
        <Flex align="center" borderBottom="1px" borderColor="#BFD7EB" h={["3.5rem", "6rem"]} px={["1rem", "3rem"]}>
            <RLink to="/">
                <Image src="/logo.svg" alt="Cryptosydra" h={["2rem", "3rem"]} />
            </RLink>
            {!!id && (<>
                <Text display={['none', 'block']} color="#0094ff" fontWeight="bold" fontSize="1.6rem"
                      ml="0.5rem">/stream/{id}</Text>
                <Link onClick={copyUrl} display={['none', 'block']}>
                    <CopyIcon boxSize="1.4rem" color="#333" ml="0.5rem" mt="0.5rem"/>
                </Link>
            </>)}
            <Spacer/>
            {walletConnectCtx.loadingSession ? <Spinner/> : (
                !walletConnectCtx.session ? (
                    <Link fontSize={["0.9rem", "1.125rem"]} textAlign="right"
                          onClick={walletConnectCtx.openPairing}>Connect your Wallet</Link>
                ) : (
                    <Flex direction="column" align="right">
                        {walletConnectCtx.accounts.map((account: string) => {
                            const [address] = account.split("@");
                            return (
                                <Flex
                                    key={address}
                                    align="center"
                                >
                                    <Image src={chainMeta.logo} alt={chainMeta.name} title={chainMeta.name} w="1.6rem"
                                           mr="0.5rem"/>
                                    <Flex direction="column">
                                        <Text fontSize="0.5rem">{walletConnectCtx.session?.peer.metadata.name}</Text>
                                        <Text fontSize="0.8rem">{ellipseAddress(address, 4)}</Text>
                                    </Flex>
                                    <Link ml="0.6rem" onClick={walletConnectCtx.disconnect}>
                                        <LogoutIcon boxSize="1.4rem" color="#004e87"/>
                                    </Link>
                                </Flex>
                            );
                        })}
                    </Flex>
                )
            )}
        </Flex>
    );
}
