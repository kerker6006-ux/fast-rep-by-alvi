/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  plan?: string
  bonusCredit?: number
  appUrl?: string
}

const SubscriptionEmail = ({
  name,
  plan = 'Basic',
  bonusCredit = 5,
  appUrl = 'https://leadpilot.life',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your LeadPilot subscription is active</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're subscribed{name ? `, ${name}` : ''} ✅</Heading>
        <Text style={text}>
          Thanks for upgrading to the <strong>{plan}</strong> plan. Your subscription is now active.
        </Text>
        <Text style={text}>
          We've also added <strong>${bonusCredit} of bonus credit</strong> to your wallet
          as a thank-you for subscribing.
        </Text>
        <Section style={{ textAlign: 'center', margin: '32px 0' }}>
          <Button href={`${appUrl}/dashboard`} style={button}>Go to dashboard</Button>
        </Section>
        <Text style={muted}>You can manage or cancel your subscription anytime from the Billing page.</Text>
        <Text style={muted}>— The LeadPilot team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionEmail,
  subject: 'Your LeadPilot subscription is active ✅',
  displayName: 'Subscription activated',
  previewData: { name: 'Alvi', plan: 'Basic', bonusCredit: 5 },
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
