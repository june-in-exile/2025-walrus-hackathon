import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Trash2, Plus } from 'lucide-react';
import { UseFormReturn, useFieldArray } from 'react-hook-form';

interface PeriodFormSectionProps {
  index: number;
  form: UseFormReturn<any>;
  onRemove: () => void;
  canRemove: boolean;
}

export function PeriodFormSection({
  index,
  form,
  onRemove,
  canRemove,
}: PeriodFormSectionProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `periods.${index}.kpiTypes`,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Period {index + 1}</CardTitle>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <FormField
            control={form.control}
            name={`periods.${index}.name`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Period Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 2026 Fiscal Year" {...field} />
                </FormControl>
                <FormDescription>
                  Descriptive name for this earn-out period
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name={`periods.${index}.startDate`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`periods.${index}.endDate`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* KPI Types */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">KPI Targets</h3>
              <p className="text-xs text-muted-foreground">
                Define performance metrics for this period
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  type: 'revenue',
                  threshold: 0,
                  unit: 'USD',
                })
              }
            >
              <Plus className="mr-1 h-3 w-3" />
              Add KPI
            </Button>
          </div>

          {fields.map((field, kpiIndex) => (
            <Card key={field.id} className="bg-muted/30">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-medium">KPI {kpiIndex + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(kpiIndex)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`periods.${index}.kpiTypes.${kpiIndex}.type`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="revenue">Revenue</SelectItem>
                            <SelectItem value="ebitda">EBITDA</SelectItem>
                            <SelectItem value="user_growth">User Growth</SelectItem>
                            <SelectItem value="arr">ARR</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`periods.${index}.kpiTypes.${kpiIndex}.unit`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., USD" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name={`periods.${index}.kpiTypes.${kpiIndex}.threshold`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Threshold *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Minimum value to achieve earn-out
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch(`periods.${index}.kpiTypes.${kpiIndex}.type`) === 'custom' && (
                  <FormField
                    control={form.control}
                    name={`periods.${index}.kpiTypes.${kpiIndex}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Custom KPI Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Customer Retention Rate" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name={`periods.${index}.kpiTypes.${kpiIndex}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Detailed KPI description..."
                          className="min-h-[60px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Earnout Formula */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold">Earn-out Formula</h3>
            <p className="text-xs text-muted-foreground">
              Define how payout is calculated based on KPI performance
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name={`periods.${index}.formula.type`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Formula Type *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select formula" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="stepped">Stepped</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    How payout scales with KPI achievement
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name={`periods.${index}.formula.maxPayout`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum Payout *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum earn-out amount for this period
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name={`periods.${index}.formula.description`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Formula Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="e.g., 10% of revenue above $10M threshold, capped at $5M"
                    className="min-h-[80px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Explain how the formula calculates payout
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
