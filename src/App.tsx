import * as React from "react"
import {
    BrowserRouter as Router,
    Switch,
    Route,
} from "react-router-dom"
import {
    ChakraProvider, Flex, Link, Spacer, Text
} from "@chakra-ui/react"
import GHIcon from "./components/icons/GHIcon"
import Home from "./views/Home"
import {WalletConnectContextProvider} from "./context/WalletConnectContext";
import Header from "./components/Header";
import ConnectToProceed from "./views/ConnectToProceed";
import CreateStream from "./views/CreateStream";
import StreamDetails from "./views/StreamDetails";
import PairingModal from "./components/modals/PairingModal";
import RequestModal from "./components/modals/RequestModal";

export default function App() {
    return (
        <ChakraProvider>
            <WalletConnectContextProvider>
                <Router>
                    <Flex direction="column" w="100vw" minH="100vh">
                        <Header/>
                        <Flex direction="column" flex={1} bg="#edf7ff" align="center"
                              backgroundImage="url(/sea.svg)" backgroundPosition="bottom" backgroundRepeat="repeat-x">

                            <Switch>
                                <Route path="/connectToProceed">
                                    <ConnectToProceed/>
                                </Route>
                                <Route path="/createStream">
                                    <CreateStream/>
                                </Route>
                                <Route path="/stream/:id">
                                    <StreamDetails/>
                                </Route>
                                <Route path="/">
                                    <Home/>
                                </Route>
                            </Switch>

                            <Flex align="center" bg="#004e87" p={["1rem", "2rem 3.25rem"]} w="100%">
                                <Text color="white">
                                    Crypsydra was created
                                    by <Link href="https://github.com/hal0x2328" target="_blank" color="#0094ff">
                                    @hal0x2328
                                </Link>, <Link href="https://github.com/melanke" target="_blank"
                                               color="#0094ff">
                                    @melanke
                                </Link> and <Link href="https://github.com/yumiuehara" target="_blank" color="#0094ff">
                                    @yumiuehara
                                </Link>
                                </Text>
                                <Spacer/>
                                <Link href="https://github.com/east-side-cryps" target="_blank" color="white">
                                    <Flex align="center">
                                        <GHIcon boxSize="1.5rem" mr="0.5rem"/>
                                        <Text fontSize="1.125rem">Fork it on Github</Text>
                                    </Flex>
                                </Link>
                            </Flex>
                        </Flex>
                    </Flex>
                    <PairingModal/>
                    <RequestModal/>
                </Router>
            </WalletConnectContextProvider>
        </ChakraProvider>
    )
}
