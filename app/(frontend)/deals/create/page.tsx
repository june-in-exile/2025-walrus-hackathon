'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCurrentAccount, useSignPersonalMessage } from '@mysten/dapp-kit';
import { useRole } from '@/src/frontend/contexts/RoleContext';
import { useCreateDeal } from '@/src/frontend/hooks/useCreateDeal';
import { RoleAccessMessage } from '@/src/frontend/components/common/RoleAccessMessage';
import { WalletButton } from '@/src/frontend/components/wallet/WalletButton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Users, DollarSign, FileText, Upload, X, Package, Plus, Trash2, Wallet, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { generateSubPeriods, SubPeriod } from '@/src/shared/utils/period-calculator';

const createDealSchema = z.object({
  // Basic Information
  dealName: z.string().min(1, 'Deal name is required'),
  buyerName: z.string().min(1, 'Buyer name is required'),
  sellerName: z.string().min(1, 'Seller name is required'),
  startDate: z.string().min(1, 'Start date is required'),

  // Blockchain Addresses
  acquireeAddress: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid Sui address format'),
  auditorAddress: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid Sui address format'),

  // Financial Parameters
  earnoutPeriodYears: z.number().int().min(1).max(10),
  kpiTargetAmount: z.number().positive(),
  contingentConsiderationAmount: z.number().positive(),
  headquarterExpenseAllocationPercentage: z.number().min(0).max(1),

  // Assets Management
  assets: z.array(z.object({
    assetID: z.string().min(1, 'Asset ID is required'),
    estimatedUsefulLife_months: z.number().int().min(1, 'Useful life must be at least 1 month'),
  })).min(1, 'At least one asset is required'),
});

type CreateDealFormData = z.infer<typeof createDealSchema>;

export default function CreateDealPage() {
  const router = useRouter();
  const { currentRole } = useRole();
  const currentAccount = useCurrentAccount();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const { createDeal, isCreating } = useCreateDeal();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const {
    register,
    control,
    formState: { errors },
    getValues,
  } = useForm<CreateDealFormData>({
    resolver: zodResolver(createDealSchema),
    defaultValues: {
      earnoutPeriodYears: 3,
      kpiTargetAmount: 700000,
      contingentConsiderationAmount: 30000000,
      headquarterExpenseAllocationPercentage: 0.1,
      startDate: '2025-11-03',

      assets: [
        { assetID: 'MACH-001A', estimatedUsefulLife_months: 120 },
        { assetID: 'MACH-001B', estimatedUsefulLife_months: 96 },
        { assetID: 'OFFICE-015', estimatedUsefulLife_months: 60 },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'assets',
  });

  // Role-based access control: Only Buyer can create deals
  if (currentRole !== 'buyer') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/deals">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deals
          </Link>
        </Button>
        <RoleAccessMessage
          allowedRole="buyer"
          currentRole={currentRole}
          featureName="Deal creation"
        />
      </div>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF file');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        return;
      }
      setUploadedFile(file);
      toast.success('MA Agreement uploaded successfully');
    }
  };
  const removeFile = () => {
    setUploadedFile(null);
    toast.info('MA Agreement removed');
  };

  const handleCreateDealClick = async () => {
    const currentData = getValues();
    const validationResult = createDealSchema.safeParse(currentData);

    if (!validationResult.success) {
      const zodErrors = validationResult.error.flatten().fieldErrors;
      console.error("Form validation failed. Details:", zodErrors);

      const errorFields = Object.keys(zodErrors);
      let description = "Please check the form for errors.";
      if (errorFields.length > 0) {
        const fieldsToShow = errorFields.slice(0, 3).join(', ');
        description = `Invalid fields include: ${fieldsToShow}...`;
      }

      toast.error("Form is invalid", {
        description: description + " See console (F12) for more details.",
      });
      return;
    }

    // If validation passes, call the original onSubmit function with the validated data
    console.log("Form is valid, submitting...");
    await onSubmit(validationResult.data);
  };
  const onSubmit = async (data: CreateDealFormData) => {
    console.log('onSubmit function triggered.');
    console.log('Form data:', data);
    console.log('Form errors:', errors);
    if (!uploadedFile) {
      toast.error('Please upload the M&A Agreement PDF');
      return;
    }

    if (!currentAccount?.address) {
      toast.error('Please connect your wallet first');
      return;
    }

    try {
      // Step 1: Sign authentication message for upload
      toast.loading('Please sign authentication message...', { id: 'sign-auth' });

      const timestamp = new Date().toISOString();
      const messageBytes = new TextEncoder().encode(timestamp);

      const signResult = await signPersonalMessage({
        message: messageBytes,
      });

      toast.dismiss('sign-auth');

      // Step 2: Upload M&A Agreement PDF to Walrus with Seal encryption
      toast.loading('Uploading M&A Agreement...', { id: 'upload-agreement' });

      const formData = new FormData();
      formData.append('file', uploadedFile);
      formData.append('dealId', 'pending'); // Placeholder since we don't have dealId yet
      formData.append('periodId', 'pending'); // Placeholder period
      formData.append('dataType', 'ma_agreement');

      const uploadResponse = await fetch('/api/v1/walrus/upload?mode=server_encrypted', {
        method: 'POST',
        headers: {
          'X-Sui-Address': currentAccount.address,
          'X-Sui-Signature': signResult.signature,
          'X-Sui-Signature-Message': timestamp,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.message || 'Failed to upload agreement');
      }

      const uploadData = await uploadResponse.json();
      const agreementBlobId = uploadData.blobId;

      toast.dismiss('upload-agreement');
      toast.success('M&A Agreement uploaded successfully');

      console.log('Agreement uploaded with blob ID:', agreementBlobId);

      // Step 2: Prepare data for deal creation
      // Calculate periodMonths
      const startDate = new Date(data.startDate);
      const endDate = new Date(startDate.getFullYear() + data.earnoutPeriodYears, startDate.getMonth(), startDate.getDate());
      const periodMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());

      // Generate subperiods
      const subperiods: SubPeriod[] = generateSubPeriods(startDate.getTime(), periodMonths);
      const subperiodIds = subperiods.map(sp => sp.periodId);
      const subperiodStartDates = subperiods.map(sp => new Date(sp.startDate).getTime());
      const subperiodEndDates = subperiods.map(sp => new Date(sp.endDate).getTime());

      // Prepare assets data
      const assetIds = data.assets.map(asset => asset.assetID);
      const assetUsefulLives = data.assets.map(asset => asset.estimatedUsefulLife_months);

      // Convert headquarter percentage from decimal to whole number (0-100)
      const headquarter = Math.round(data.headquarterExpenseAllocationPercentage * 100);

      console.log('Creating deal with:');
      console.log('- Agreement Blob ID:', agreementBlobId);
      console.log('- Headquarter:', headquarter);
      console.log('- Asset IDs:', assetIds);
      console.log('- Asset Useful Lives:', assetUsefulLives);
      console.log('- Period Months:', periodMonths);
      console.log('- Subperiods:', subperiods);

      // Step 3: Create the deal on-chain
      await createDeal({
        agreementBlobId,
        name: data.dealName,
        sellerAddress: data.acquireeAddress,
        auditorAddress: data.auditorAddress,
        startDateMs: startDate.getTime(),
        periodMonths: periodMonths,
        kpiThreshold: data.kpiTargetAmount,
        maxPayout: data.contingentConsiderationAmount,
        headquarter,
        assetIds,
        assetUsefulLives,
        subperiodIds: subperiodIds,
        subperiodStartDates: subperiodStartDates,
        subperiodEndDates: subperiodEndDates,
        onSuccess: (txDigest) => {
          console.log('Deal created successfully with transaction:', txDigest);
          router.push('/deals');
        },
        onError: (error) => {
          console.error('Failed to create deal:', error);
        },
      });
    } catch (error) {
      toast.dismiss('upload-agreement');
      console.error('Error during deal creation:', error);
      toast.error('Failed to create deal', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/deals">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Deals
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Create New Earn-out Deal</h1>
        <p className="text-muted-foreground mt-2">
          Set up a new earn-out agreement with all required parameters and documentation
        </p>
      </div>

      <form className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              Enter the fundamental details of the M&A transaction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="dealName">Deal Name</Label>
              <Input
                id="dealName"
                placeholder="e.g., BuyYou Inc. & Global Tech Solutions Inc. Asset Purchase"
                {...register('dealName')}
              />
              {errors.dealName && (
                <p className="text-sm text-destructive mt-1">{errors.dealName.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="buyerName">Buyer Name</Label>
                <Input
                  id="buyerName"
                  placeholder="e.g., BuyYou Inc."
                  {...register('buyerName')}
                />
                {errors.buyerName && (
                  <p className="text-sm text-destructive mt-1">{errors.buyerName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="sellerName">Seller Name</Label>
                <Input
                  id="sellerName"
                  placeholder="e.g., Global Tech Solutions Inc."
                  {...register('sellerName')}
                />
                {errors.sellerName && (
                  <p className="text-sm text-destructive mt-1">{errors.sellerName.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blockchain Addresses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Blockchain Addresses
            </CardTitle>
            <CardDescription>
              Sui wallet addresses for all parties involved in the deal. Your connected wallet will be used as the Buyer address.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="acquireeAddress">Acquiree Address (Seller)</Label>
              <Input
                id="acquireeAddress"
                placeholder="0x..."
                {...register('acquireeAddress')}
                className="font-mono text-sm"
              />
              {errors.acquireeAddress && (
                <p className="text-sm text-destructive mt-1">{errors.acquireeAddress.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="auditorAddress">Auditor Address</Label>
              <Input
                id="auditorAddress"
                placeholder="0x..."
                {...register('auditorAddress')}
                className="font-mono text-sm"
              />
              {errors.auditorAddress && (
                <p className="text-sm text-destructive mt-1">{errors.auditorAddress.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financial Parameters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Financial Parameters
            </CardTitle>
            <CardDescription>
              Configure the earn-out terms and KPI targets
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate')}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive mt-1">{errors.startDate.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                The date when the earn-out period begins
              </p>
            </div>
            <div>
              <Label htmlFor="earnoutPeriodYears">Earn-out Period (Years)</Label>
              <Input
                id="earnoutPeriodYears"
                type="number"
                min="1"
                max="10"
                {...register('earnoutPeriodYears', { valueAsNumber: true })}
              />
              {errors.earnoutPeriodYears && (
                <p className="text-sm text-destructive mt-1">{errors.earnoutPeriodYears.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="kpiTargetAmount">KPI Target Amount</Label>
              <Input
                id="kpiTargetAmount"
                type="number"
                step="1"
                placeholder="e.g., 700000"
                {...register('kpiTargetAmount', { valueAsNumber: true })}
              />
              {errors.kpiTargetAmount && (
                <p className="text-sm text-destructive mt-1">{errors.kpiTargetAmount.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                The target amount for the Key Performance Indicator.
              </p>
            </div>

            <div>
              <Label htmlFor="contingentConsiderationAmount">Contingent Consideration Amount</Label>
              <Input
                id="contingentConsiderationAmount"
                type="number"
                step="1"
                placeholder="e.g., 30000000"
                {...register('contingentConsiderationAmount', { valueAsNumber: true })}
              />
              {errors.contingentConsiderationAmount && (
                <p className="text-sm text-destructive mt-1">{errors.contingentConsiderationAmount.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                The amount of consideration payable contingent on meeting the KPI.
              </p>
            </div>


            <div>
              <Label htmlFor="headquarterExpenseAllocationPercentage">
                Headquarter Expense Allocation (%)
              </Label>
              <Controller
                name="headquarterExpenseAllocationPercentage"
                control={control}
                render={({ field }) => (
                  <Input
                    id="headquarterExpenseAllocationPercentage"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    placeholder="e.g., 10"
                    value={field.value === undefined ? '' : field.value * 100}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        field.onChange(undefined);
                      } else {
                        const num = parseFloat(value);
                        if (!isNaN(num) && num >= 0 && num <= 100) {
                          field.onChange(num / 100);
                        }
                      }
                    }}
                  />
                )}
              />
              {errors.headquarterExpenseAllocationPercentage && (
                <p className="text-sm text-destructive mt-1">
                  {errors.headquarterExpenseAllocationPercentage.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Percentage of corporate overhead pool allocated to this business unit
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Assets Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Assets Management
            </CardTitle>
            <CardDescription>
              Specify the fixed assets included in this deal for depreciation calculation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-sm">Asset {index + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor={`assets.${index}.assetID`}>Asset ID</Label>
                    <Input
                      id={`assets.${index}.assetID`}
                      placeholder="e.g., MACH-001A"
                      {...register(`assets.${index}.assetID` as const)}
                    />
                    {errors.assets?.[index]?.assetID && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.assets[index]?.assetID?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor={`assets.${index}.estimatedUsefulLife_months`}>
                      Estimated Useful Life (Months)
                    </Label>
                    <Input
                      id={`assets.${index}.estimatedUsefulLife_months`}
                      type="number"
                      min="1"
                      placeholder="e.g., 120"
                      {...register(`assets.${index}.estimatedUsefulLife_months` as const, {
                        valueAsNumber: true,
                      })}
                    />
                    {errors.assets?.[index]?.estimatedUsefulLife_months && (
                      <p className="text-sm text-destructive mt-1">
                        {errors.assets[index]?.estimatedUsefulLife_months?.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ assetID: '', estimatedUsefulLife_months: 120 })}
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Asset
            </Button>

            {errors.assets?.root && (
              <p className="text-sm text-destructive">{errors.assets.root.message}</p>
            )}
          </CardContent>
        </Card>

        {/* M&A Agreement Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              M&A Agreement Document
            </CardTitle>
            <CardDescription>
              Upload the signed M&A agreement PDF (required)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!uploadedFile ? (
              <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                <input
                  type="file"
                  id="ma-agreement"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label htmlFor="ma-agreement" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm font-medium mb-1">Click to upload M&A Agreement</p>
                  <p className="text-xs text-muted-foreground">PDF file, max 10MB</p>
                </label>
              </div>
            ) : (
              <div className="border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium text-sm">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(uploadedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallet Connection & Submit */}
        <Card>
          <CardContent className="pt-6">
            {!currentAccount ? (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Wallet className="h-5 w-5" />
                  <span>Connect your wallet to create a deal</span>
                </div>
                <WalletButton />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Wallet className="h-4 w-4" />
                  <span>Connected: {currentAccount.address.slice(0, 8)}...{currentAccount.address.slice(-6)}</span>
                </div>
                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push('/deals')}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button type="button" disabled={isCreating} onClick={handleCreateDealClick}>
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Deal...
                      </>
                    ) : (
                      'Create Deal'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
