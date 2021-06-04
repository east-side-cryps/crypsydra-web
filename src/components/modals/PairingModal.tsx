import * as React from "react";

import Pairing from "../Pairing";
import {
    Button,
    Flex, Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalOverlay
} from "@chakra-ui/react";
import {useWalletConnect} from "@cityofzion/wallet-connect-sdk-react";

export default function PairingModal() {
    const walletConnectCtx = useWalletConnect()

    const handleClose = () => {
        walletConnectCtx.setIsPairing(false)
    }

    return (
        <Modal isOpen={!!walletConnectCtx.isPairing} onClose={handleClose}>
            <ModalOverlay/>
            <ModalContent>
                <ModalHeader>Select available pairing or create new one</ModalHeader>
                <ModalCloseButton/>
                <ModalBody>
                    <Flex direction="column" align="center">
                        {walletConnectCtx.wcClient?.pairing.values.map((pairing: any) => (
                            <Pairing
                                key={pairing.topic}
                                pairing={pairing}
                                onClick={() => walletConnectCtx.connect(pairing.topic)}
                            />
                        ))}
                    </Flex>
                </ModalBody>

                <ModalFooter>
                    <Button onClick={() => walletConnectCtx.connect()}>{`New Pairing`}</Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};
