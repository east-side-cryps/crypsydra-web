import * as React from "react";
import {Flex, Text} from "@chakra-ui/react";
import {Stream} from "../types/Stream";
import {format} from "date-fns";
import {Link} from "react-router-dom";

export default function LiStream(props: { stream: Stream }) {

    const startFormatted = () => {
        return format(props.stream.start, 'yyyy/MM/dd HH:mm:ss')
    }

    const endFormatted = () => {
        return format(props.stream.stop, 'yyyy/MM/dd HH:mm:ss')
    }

    return (
        <Link to={`/stream/${props.stream.id}`}>
            <Flex align="center" w="100%" p="0.5rem" bg="white">
                <Text color="#0094ff" fontWeight="bold" fontSize="2rem">
                    #{props.stream.id}
                </Text>
                <Flex direction="column" flex={1} mx="0.5rem">
                    <Text color="#004e87" fontWeight="bold" fontSize="0.8rem">{startFormatted()}</Text>
                    <Text color="#004e87" fontWeight="bold" fontSize="0.8rem">{endFormatted()}</Text>
                </Flex>
                <Text color="#004e87" fontWeight="bold" fontSize="1.6rem">{props.stream.deposit} GAS</Text>
            </Flex>
        </Link>
    );
}
