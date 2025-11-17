import Image from 'next/image';

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto flex flex-col gap-4 py-8 md:flex-row md:justify-between md:py-6 px-4">
        {/* Left section */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Image
              src="/M&A Logo.png"
              alt="M&A Logo"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-sm font-semibold">Earn-out Platform</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Decentralized M&A earn-out management on Sui blockchain with Walrus storage and Seal encryption.
          </p>
        </div>

        {/* Right section */}
        <div className="flex flex-col gap-4 md:flex-row md:gap-8">
          <div>
            <h3 className="text-sm font-semibold mb-2">Technology</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://sui.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Sui Blockchain
                </a>
              </li>
              <li>
                <a
                  href="https://walrus.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Walrus Storage
                </a>
              </li>
              <li>
                <a
                  href="https://seal.mystenlabs.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Seal Encryption
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold mb-2">Resources</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>
                <a
                  href="/api-docs"
                  className="hover:text-foreground transition-colors"
                >
                  API Documentation
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/marvelcn015/2025-walrus-hackathon"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom section */}
      <div className="border-t">
        <div className="container mx-auto py-4 text-center text-sm text-muted-foreground px-4">
          Built for Walrus Hackathon 2025
        </div>
      </div>
    </footer>
  );
}
