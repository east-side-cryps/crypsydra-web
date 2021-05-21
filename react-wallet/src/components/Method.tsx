import * as React from "react";
import styled from "styled-components";
import { fonts, colors, shadows } from "../styles";

const SMethod = styled.div`
  border: none;
  color: rgb(${colors.white});
  background: rgba(51, 217, 178, 1);
  border-style: none;
  padding: 12px;
  outline: none;
  font-size: ${fonts.size.large};
  font-weight: ${fonts.weight.bold};
  font-style: normal;
  font-stretch: normal;
  line-height: normal;
  letter-spacing: normal;
  text-align: left;
  border-radius: 8px;
  box-shadow: 0 0 0 0 rgba(51, 217, 178, 1);
  cursor: pointer;
  margin-bottom: 10px;
  animation: pulse-green 2s infinite;
`;

const Method = (props: any) => <SMethod {...props} />;

export default Method;
