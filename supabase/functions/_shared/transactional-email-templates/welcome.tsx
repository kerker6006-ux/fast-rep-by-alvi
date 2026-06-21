/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  appUrl?: string
}

const WelcomeEmail = ({ name, appUrl = 'https://leadpilot.life' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to LeadPilot — your AI sales co-pilot is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to LeadPilot{name ? `, ${name}` : ''} 🎉</Heading>
        <Text style={text}>
          Thanks for signing up. Your account is ready and we've added
          <strong> $2 of free credit </strong> so you can start replying to leads instantly.
        </Text>
        <Text style={text}>
          Connect your Facebook page, import your product catalog, and let the bot handle
          DMs and comments for you 24/7.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={`${appUrl}/dashboard`} style={button}>Open your dashboard</Button>
        </Section>
        <Text style={muted}>If you have any questions, just reply to this email — we read every message.</Text>
        <Text style={muted}>— The LeadPilot team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to LeadPilot 🎉',
  displayName: 'Welcome email',
  previewData: { name: 'Alvi' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = { color: '#0f172a', fontSize: '24px', fontWeight: 700, margin: '0 0 16px' }
const text = { color: '#334155', fontSize: '15px', lineHeight: '24px', margin: '0 0 16px' }
const muted = { color: '#64748b', fontSize: '13px', lineHeight: '20px', margin: '8px 0' }
const button = {
  backgroundColor: '#2563EB', color: '#ffffff', padding: '12px 24px',
  borderRadius: '14px', fontSize: '15px', fontWeight: 600, textDecoration: 'none',
}
