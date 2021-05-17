import * as React from "react";

import Pairing from "../components/Pairing";
import {Button, Flex, ModalBody, ModalCloseButton, ModalFooter, ModalHeader} from "@chakra-ui/react";
import {useWalletConnect} from "../context/WalletConnectContext";

export default function PairingModal() {
    const walletConnectCtx = useWalletConnect()

    return (
        <>
            <ModalHeader>Select available pairing or create new one</ModalHeader>
            <ModalCloseButton/>
            <ModalBody>
                <Flex direction="column" align="center">
                    {walletConnectCtx?.wcClient?.pairing.values.map(pairing => (
                        <Pairing
                            key={pairing.topic}
                            pairing={pairing}
                            onClick={() => walletConnectCtx.connect({topic: pairing.topic})}
                        />
                    ))}
                </Flex>
            </ModalBody>

            <ModalFooter>
                <Button onClick={() => walletConnectCtx?.connect()}>{`New Pairing`}</Button>
            </ModalFooter>
        </>
    );
};
