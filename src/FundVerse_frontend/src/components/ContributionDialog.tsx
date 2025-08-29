import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { formatCurrency, handleICError } from '../lib/utils';
import { Loader2, TrendingUp, Zap, AlertCircle, CheckCircle, Coins } from 'lucide-react';

const contributionSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
}).refine((data) => {
  const amount = parseFloat(data.amount);
  return amount > 0 && amount <= 10000; // Max 10000 ICP
}, {
  message: 'Amount must be between 0.00000001 and 10000 ICP',
});

type ContributionForm = z.infer<typeof contributionSchema>;

interface ContributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: bigint;
  campaignTitle: string;
  fundFlowActor: any;
  backendActor: any;
  onContributionSuccess: () => void;
}

export const ContributionDialog: React.FC<ContributionDialogProps> = ({
  open,
  onOpenChange,
  campaignId,
  campaignTitle,
  fundFlowActor,
  backendActor,
  onContributionSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ContributionForm>({
    resolver: zodResolver(contributionSchema),
  });

  const amount = watch('amount');
  const amountE8s = amount ? Math.floor(parseFloat(amount) * 100_000_000) : 0;

  const onSubmit = async (data: ContributionForm) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);
    
    try {
      // First, register the user if not already registered
      try {
        await fundFlowActor.register_user('FundVerse User', 'user@fundverse.com');
      } catch (error) {
        // User might already be registered, continue
        console.log('User registration skipped (likely already registered):', error);
      }

      // Get backend canister principal
      const backendPrincipal = backendActor._canisterId || backendActor.canisterId;
      
      // Make the ICP contribution
      const result = await fundFlowActor.contribute_icp(
        backendPrincipal,
        campaignId,
        BigInt(amountE8s)
      );

      if ('Err' in result) {
        throw new Error(result.Err);
      }

      const contributionId = result.Ok;

      // Confirm the payment (in a real app, this would be done after actual ICP transfer)
      const confirmResult = await fundFlowActor.confirm_payment(
        contributionId, 
        backendPrincipal
      );

      if ('Err' in confirmResult) {
        throw new Error(confirmResult.Err);
      }

      setSuccess(true);
      setTimeout(() => {
        reset();
        onContributionSuccess();
      }, 2000);

    } catch (error) {
      console.error('Failed to contribute:', error);
      const icError = handleICError(error);
      setError(icError.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      onOpenChange(false);
      setError(null);
      setSuccess(false);
      reset();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px] web3-card border-white/20">
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-2xl web3-gradient-text flex items-center gap-2">
            <Coins className="h-6 w-6" />
            Contribute ICP
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Make a contribution to <span className="text-white font-semibold">"{campaignTitle}"</span> using ICP coins on the Internet Computer.
          </DialogDescription>
        </DialogHeader>
        
        {success ? (
          <div className="py-8 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center glow-green">
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-green-400">Contribution Successful!</h3>
              <p className="text-muted-foreground">
                Your contribution of {formatCurrency(parseFloat(amount || '0'))} has been processed.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="amount" className="text-sm font-medium flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Amount (ICP)
              </Label>
              <Input
                id="amount"
                type="number"
                step="0.00000001"
                {...register('amount')}
                placeholder="0.00000000"
                className="web3-input h-12 text-lg"
                disabled={isLoading}
              />
              {errors.amount && (
                <p className="text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.amount.message}
                </p>
              )}
              {amount && (
                <div className="web3-card p-3 space-y-1">
                  <p className="text-sm text-muted-foreground">Equivalent in e8s:</p>
                  <p className="font-mono text-lg web3-gradient-text">
                    {amountE8s.toLocaleString()} e8s
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="web3-card p-4 border-red-500/20 bg-red-500/10">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              </div>
            )}

            <div className="web3-card p-4 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400" />
                Contribution Details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campaign ID:</span>
                  <span className="font-mono text-white">#{campaignId.toString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span className="text-white">ICP Transfer</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network:</span>
                  <span className="text-white">Internet Computer</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="text-green-400">Instant Settlement</span>
                </div>
              </div>
            </div>

            <DialogFooter className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
                className="btn-web3-secondary"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading || !amount}
                className="btn-web3-primary flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Contribute {amount ? formatCurrency(parseFloat(amount)) : 'ICP'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContributionDialog;