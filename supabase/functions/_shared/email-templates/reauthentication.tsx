/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your LeadPilot verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandHeader}>
          <Text style={brandName}>LeadPilot</Text>
        </Section>
        <Heading style={h1}>Confirm reauthentication</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'DM Sans', 'Segoe UI', Arial, sans-serif",
}
const container = {
  padding: '32px 24px',
  maxWidth: '480px',
  margin: '0 auto',
}
const brandHeader = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}
const brandName = {
  fontFamily: "'Space Grotesk', 'DM Sans', Arial, sans-serif",
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#2563eb',
  letterSpacing: '-0.02em',
  margin: '0',
}
const h1 = {
  fontFamily: "'Space Grotesk', 'DM Sans', Arial, sans-serif",
  fontSize: '26px',
  fontWeight: 'bold' as const,
  color: '#0f172a',
  margin: '0 0 20px',
  letterSpacing: '-0.02em',
}
const text = {
  fontSize: '15px',
  color: '#64748b',
  lineHeight: '1.6',
  margin: '0 0 20px',
}
const codeStyle = {
  fontFamily: "'Space Grotesk', 'DM Sans', monospace",
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#0f172a',
  letterSpacing: '0.1em',
  margin: '0 0 30px',
  padding: '16px 24px',
  backgroundColor: '#f1f5f9',
  borderRadius: '14px',
  textAlign: 'center' as const,
}
const footer = {
  fontSize: '13px',
  color: '#94a3b8',
  margin: '32px 0 0',
  lineHeight: '1.5',
}
