import {Link, Spacer, Text} from "@chakra-ui/react";
import WalletIcon from "../components/icons/WalletIcon";
import {useWalletConnect} from "@cityofzion/wallet-connect-sdk-react";
import React, {useEffect} from "react";
import {useHistory} from "react-router-dom";
import SpinnerWithMessage from "../components/SpinnerWithMessage";

export default function ConnectToProceed() {
    const walletConnectCtx = useWalletConnect()
    const history = useHistory()

    useEffect(() => {
        if (!walletConnectCtx.loadingSession) {
            if (walletConnectCtx.session) {
                history.goBack()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletConnectCtx.loadingSession, walletConnectCtx.session])

    return (<>
        {walletConnectCtx.loadingSession ? <><Spacer/><SpinnerWithMessage xl={true} message="Loading WalletConnect Session" /><Spacer/></> : (<>
            <Spacer/>
            <Text color="#004e87" fontSize={["1.4rem", "2rem"]} textAlign="center" m="0.5rem">
                You need to connect to your wallet before proceeding
            </Text>
            <WalletIcon boxSize="10rem" color="#004e87" m="2rem"/>
            <Link color="white" bg="#0094ff" m="0.5rem" p={["0.5rem 1rem", "0.8rem 4rem"]}
                  textAlign="center"
                  _hover={{textDecoration: 'none', backgroundColor: '#0081dc'}}
                  onClick={walletConnectCtx.openPairing}>
                <Text fontSize="2rem">Connect Wallet</Text>
            </Link>
            <Spacer/>
            <Spacer/>
        </>)}
    </>)
}