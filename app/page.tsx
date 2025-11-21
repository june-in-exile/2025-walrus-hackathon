'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Shield, Database, Lock, FileText, Users, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="w-full flex flex-col items-center justify-center py-24 md:py-32 text-center px-4">
        <div className="container max-w-6xl mx-auto">
          <Badge variant="outline" className="mb-4 mx-auto">
            Built on Sui + Walrus + Seal
          </Badge>

          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl mx-auto">
            Decentralized M&A Earn-out Management
          </h1>

          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Track and settle acquisition earn-outs on-chain with transparent KPI verification,
            encrypted financial data storage, and automated settlements.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-lg px-8" asChild>
              <Link href="#features">
                Learn More
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Connect your Sui wallet above to get started
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="w-full py-20 md:py-24 bg-muted/30 px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why Use Earn-out Platform?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for buyers, sellers, and auditors to manage M&A earn-outs with full transparency
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Shield className="h-8 w-8" />}
            title="On-Chain Trust"
            description="All deal parameters, KPIs, and settlements are recorded immutably on Sui blockchain"
          />
          <FeatureCard
            icon={<Lock className="h-8 w-8" />}
            title="Encrypted Storage"
            description="Financial documents stored on Walrus with role-based access control via Seal encryption"
          />
          <FeatureCard
            icon={<Users className="h-8 w-8" />}
            title="Role-Based Access"
            description="Buyer, seller, and auditor roles with specific permissions enforced on-chain"
          />
          <FeatureCard
            icon={<FileText className="h-8 w-8" />}
            title="KPI Verification"
            description="Auditors independently verify KPI calculations before settlement execution"
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8" />}
            title="Automated Settlement"
            description="Execute earn-out payments automatically based on attested KPIs and formulas"
          />
          <FeatureCard
            icon={<Database className="h-8 w-8" />}
            title="Decentralized Data"
            description="All financial documents stored on Walrus network, ensuring data availability"
          />
          </div>
        </div>
      </section>

      {/* Technology Stack Section */}
      <section className="w-full py-20 md:py-24 px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Powered by Cutting-Edge Technology
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Leveraging the best of Web3 infrastructure
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-5xl mx-auto">
          <TechCard
            name="Sui Blockchain"
            description="High-performance L1 blockchain with Move smart contracts for secure earn-out logic"
            link="https://sui.io"
          />
          <TechCard
            name="Walrus Storage"
            description="Decentralized blob storage for financial documents with cryptographic guarantees"
            link="https://walrus.xyz"
          />
          <TechCard
            name="Seal Encryption"
            description="On-chain access control for encrypted data with role-based permissions"
            link="https://docs.sui.io/standards/seal"
          />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-20 md:py-24 bg-muted/30 px-4">
        <div className="container max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to Get Started?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Connect your Sui wallet to create your first earn-out deal
            </p>
            <div className="mt-8">
              <p className="text-sm text-muted-foreground">
                Use the Connect Wallet button in the header to begin
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 rounded-lg bg-primary/10 p-3 text-primary">
            {icon}
          </div>
          <h3 className="text-xl font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TechCard({
  name,
  description,
  link,
}: {
  name: string;
  description: string;
  link: string;
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="pt-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-3">{name}</h3>
          <p className="text-sm text-muted-foreground mb-4">{description}</p>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline inline-flex items-center"
          >
            Learn more
            <ArrowRight className="ml-1 h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
