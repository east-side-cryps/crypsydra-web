import React, {useEffect, useState} from "react";
import {useHistory} from "react-router-dom";
import {
    Flex,
    Spacer,
    Text,
    FormControl,
    Input,
    FormLabel,
    Button,
    useToast,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper
} from "@chakra-ui/react";
import {useWalletConnect} from "@cityofzion/wallet-connect-sdk-react";
import {
    DEFAULT_GAS_SCRIPTHASH,
    DEFAULT_GAS_PRECISION,
    DEFAULT_NEO_NETWORK_MAGIC,
    DEFAULT_NEO_RPC_ADDRESS,
    DEFAULT_SC_SCRIPTHASH
} from "../constants";
import {ContractParamJson} from "@cityofzion/neon-core/lib/sc";
import {N3Helper} from "../helpers/N3Helper";
import SpinnerWithMessage from "../components/SpinnerWithMessage";

const formControlStyle = {
    maxWidth: "35rem", marginBottom: "2rem"
}

const formLabelStyle = {
    color: "#004e87", fontSize: "0.8rem", margin: 0
}
const inputStyle = {
    border: "solid 1px #0094ff",
    backgroundColor: "white",
    borderRadius: 0,
    height: "3.5rem",
}

export default function CreateStream() {
    const walletConnectCtx = useWalletConnect()
    const history = useHistory()
    const toast = useToast()

    const n3Helper = new N3Helper(DEFAULT_NEO_RPC_ADDRESS, DEFAULT_NEO_NETWORK_MAGIC)

    const [recipientAddress, setRecipientAddress] = useState('')
    const [totalAmountOfGas, setTotalAmountOfGas] = useState('')
    const [startDatetime, setStartDatetime] = useState('')
    const [endDatetime, setEndDatetime] = useState('')
    const [loading, setLoading] = useState<string | null>('Checking WalletConnect Session')

    useEffect(() => {
        if (!walletConnectCtx.loadingSession) {
            if (!walletConnectCtx.session) {
                history.push('/connectToProceed')
            } else {
                setLoading(null)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walletConnectCtx.loadingSession, walletConnectCtx.session])

    const handleSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault()

        const txId = await createStream()
        if (!txId) return
        setLoading('Validating Result')
        const notification = (await n3Helper.getNotificationsFromTxId(txId))
            .find((n: any) => n.contract === DEFAULT_SC_SCRIPTHASH && n.eventname === 'StreamCreated')
        if (!notification) return
        const hexstring = ((notification.state.value as ContractParamJson[])[0].value as string)
        const json = atob(hexstring)
        const data = JSON.parse(json)
        if (!data) return
        setLoading(null)
        history.push(`/stream/${data.id}`)
    }

    const createStream = async () => {

        const [senderAddress] = walletConnectCtx.accounts[0].split("@")

        // we are using GasToken contract, calling the 'transfer' method.
        // but we are transfering this gas to our smartcontract instead of a regular account
        // the GasToken will call our smartcontract's 'onNEP17Payment' method
        // the `args` variable represents the `data` parameter of 'onNEP17Payment'.
        const gasScriptHash = DEFAULT_GAS_SCRIPTHASH
        const contractScriptHash = DEFAULT_SC_SCRIPTHASH
        const from = {type: 'Address', value: senderAddress}
        const contract = {type: 'ScriptHash', value: contractScriptHash}
        const value = {type: 'Integer', value: Math.ceil(Number(totalAmountOfGas) * DEFAULT_GAS_PRECISION)}

        const contractMethod = {type: 'String', value: 'createStream'}
        const to = {type: 'Address', value: recipientAddress}
        const startTime = {type: 'Integer', value: new Date(startDatetime).getTime() }
        const endTime = {type: 'Integer', value: new Date(endDatetime).getTime() }
        const args = {type: 'Array', value: [contractMethod, to, startTime, endTime]}

        const resp = await walletConnectCtx.invokeFunction(gasScriptHash, 'transfer', [from, contract, value, args])

        if (resp.result.error && resp.result.error.message) {
            toast({
                title: resp.result.error.message,
                status: "error",
                duration: 10000,
                isClosable: true,
            })
            return null
        }

        return resp.result as string
    }

    return (
        <Flex as="form" onSubmit={handleSubmit} direction="column" align="center" flex="1" w="100%" px="0.5rem">
            {loading ? <><Spacer/><SpinnerWithMessage xl={true} message={loading} /><Spacer/></> : (<>
            <Text color="#004e87" fontWeight="bold" fontSize="2rem" m="2rem">Stream Registration</Text>
            <FormControl style={formControlStyle} isRequired>
                <FormLabel style={formLabelStyle}>Recipient Address</FormLabel>
                <Input
                    style={inputStyle}
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}/>
            </FormControl>
            <FormControl style={formControlStyle} isRequired>
                <FormLabel style={formLabelStyle}>Total Amount of Gas</FormLabel>
                <NumberInput
                    step={0.00000001}
                    precision={8}
                    value={totalAmountOfGas}
                    onChange={(value) => setTotalAmountOfGas(value)}>
                    <NumberInputField style={inputStyle}/>
                    <NumberInputStepper>
                        <NumberIncrementStepper/>
                        <NumberDecrementStepper/>
                    </NumberInputStepper>
                </NumberInput>
            </FormControl>
            <FormControl style={formControlStyle}>
                <FormLabel style={formLabelStyle}>Start Datetime</FormLabel>
                <Input
                    type="datetime-local"
                    style={inputStyle}
                    value={startDatetime}
                    onChange={(e) => setStartDatetime(e.target.value)}/>
            </FormControl>
            <FormControl style={formControlStyle} isRequired>
                <FormLabel style={formLabelStyle}>End Datetime</FormLabel>
                <Input
                    type="datetime-local"
                    style={inputStyle}
                    value={endDatetime}
                    onChange={(e) => setEndDatetime(e.target.value)}/>
            </FormControl>
            <Button borderRadius={0} type="submit" w="100%" maxWidth="35rem" bg="#0094ff" textColor="white" fontSize="2rem" h="4rem"
                    mb="2rem"
                    _hover={{backgroundColor: '#0081dc'}}>
                Create
            </Button>
            <Spacer/>
            </>)}
        </Flex>
    )
}
