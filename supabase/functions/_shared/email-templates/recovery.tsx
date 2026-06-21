/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your LeadPilot password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandHeader}>
          <Text style={brandName}>LeadPilot</Text>
        </Section>
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your password for LeadPilot. Click the
          button below to choose a new password.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          If you didn't request a password reset, you can safely ignore this
          email. Your password will not be changed.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '14px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)',
}
const footer = {
  fontSize: '13px',
  color: '#94a3b8',
  margin: '32px 0 0',
  lineHeight: '1.5',
}
