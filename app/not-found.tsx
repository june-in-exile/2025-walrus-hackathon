import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 my-15 text-center">
      <div className="mb-6 rounded-full bg-muted p-6">
        <FileQuestion className="h-16 w-16 text-muted-foreground" />
      </div>

      <h1 className="text-4xl font-bold tracking-tight mb-2">
        404
      </h1>

      <h2 className="text-2xl font-semibold mb-4">
        Page Not Found
      </h2>

      <p className="text-muted-foreground mb-8 max-w-md">
        The page you're looking for doesn't exist.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Button asChild>
          <Link href="/landing">
            Go to Home
          </Link>
        </Button>

        <Button variant="outline" asChild>
          <Link href="/deals">
            View Deals
          </Link>
        </Button>
      </div>
    </div>
  );
}
