'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Search,
  Filter,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UploadedFilesList } from '@/src/frontend/components/features/upload/UploadedFilesList';

interface BlobReference {
  blobId: string;
  dataType: string;
  uploadedAt: string;
  uploaderAddress: string;
  metadata?: {
    filename?: string;
    description?: string;
    dataType?: string;
    customDataType?: string;
    periodId?: string;
  };
}

export default function DealBlobsPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.dealId as string;

  const [blobs, setBlobs] = useState<BlobReference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [dataTypeFilter, setDataTypeFilter] = useState<string>('all');

  useEffect(() => {
    const fetchBlobs = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/v1/deals/${dealId}/blobs`);

        if (!response.ok) {
          throw new Error(`Failed to fetch blobs: ${response.statusText}`);
        }

        const data = await response.json();
        setBlobs(data);
      } catch (err) {
        console.error('Error fetching blobs:', err);
        setError(err instanceof Error ? err.message : 'Failed to load blobs');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlobs();
  }, [dealId]);

  // Filter blobs based on search and dataType
  const filteredBlobs = blobs.filter((blob) => {
    const matchesSearch = searchQuery === '' ||
      blob.metadata?.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      blob.metadata?.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      blob.blobId.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDataType = dataTypeFilter === 'all' || blob.dataType === dataTypeFilter;

    return matchesSearch && matchesDataType;
  });

  // Get unique data types for filter dropdown
  const uniqueDataTypes = Array.from(new Set(blobs.map(b => b.dataType)));

  return (
    <div className="w-full">
      {/* Header */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/deals/${dealId}`)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">All Documents</h1>
              <p className="text-muted-foreground">
                View all uploaded documents for this deal
              </p>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {blobs.length} {blobs.length === 1 ? 'Document' : 'Documents'}
            </Badge>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by filename, description, or blob ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={dataTypeFilter} onValueChange={setDataTypeFilter}>
                <SelectTrigger>
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueDataTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="text-sm text-muted-foreground flex items-center">
                Showing {filteredBlobs.length} of {blobs.length} documents
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blobs List */}
        <UploadedFilesList
          files={filteredBlobs.map(blob => ({
            filename: blob.metadata?.filename || 'Untitled Document',
            dataType: blob.dataType,
            customDataType: blob.metadata?.customDataType,
            description: blob.metadata?.description,
            size: 0, // TODO: Walrus API does not provide file size in blob metadata.
            // This should be fetched if needed, or a default value used.
            uploadedAt: new Date(blob.uploadedAt),
            blobId: blob.blobId,
          }))}
          dealId={dealId}
        />
      </section>
    </div>
  );
}
