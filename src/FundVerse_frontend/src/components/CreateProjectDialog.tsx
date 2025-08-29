import React, { useState, useEffect } from 'react';
import type { ActorSubclass } from "@dfinity/agent";

import type { _SERVICE as FundVerseBackendService } from "../../../declarations/FundVerse_backend/FundVerse_backend.did";
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
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { createFundVerseBackendActor} from '../lib/ic';
import { Plus, Loader2 } from 'lucide-react';



const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500, 'Description must be less than 500 characters'),
  fundingGoal: z.string().min(1, 'Funding goal is required'),
  legalEntity: z.string().min(1, 'Legal entity is required'),
  contactInfo: z.string().email('Valid email is required'),
  category: z.string().min(1, 'Category is required'),
  businessRegistration: z.string().min(1, 'Business registration is required'),
});

type CreateProjectForm = z.infer<typeof createProjectSchema>;
interface CreateProjectDialogProps {
  backendActor: ActorSubclass<FundVerseBackendService>; // ✅ strongly typed actor
  onProjectCreated: () => void;
}


// interface CreateProjectDialogProps {
//   backendActor: FundVerseBackend;
//   onProjectCreated: () => void;
// }

export const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({
  backendActor,
  onProjectCreated,
}) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null); 
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateProjectForm>({
    resolver: zodResolver(createProjectSchema),
  });

  
      
const onSubmit = async (data: CreateProjectForm) => {
  setIsLoading(true);
  setSubmitError(null);
  try {
    // 1) goal -> e8s
    const fundingGoalE8s = Math.floor(parseFloat(data.fundingGoal) * 100_000_000);
    if (Number.isNaN(fundingGoalE8s) || fundingGoalE8s <= 0) {
      throw new Error('Funding goal must be a positive number');
    }

    // 2) businessRegistration -> nat8
    const businessRegNat8 = Number(data.businessRegistration) & 0xff;

    // 3) create idea (بيرجع nat64 -> bigint في تايب سكريبت)
    const ideaId: bigint = await backendActor.create_idea(
      data.title,
      data.description,
      BigInt(fundingGoalE8s),
      data.legalEntity,
      data.contactInfo,
      data.category,
      businessRegNat8
    );

    // 4) نحسب end_date بعد 30 يوم (بالـ seconds)
    const nowSecs = Math.floor(Date.now() / 1000);
    const endDateSecs = nowSecs + (30 * 24 * 60 * 60);

    // 5) نعمل Campaign لنفس الـ idea (بـ نفس الـ goal)
    const createRes = await backendActor.create_campaign(
      // create_campaign بياخد nat64 → ابعتي BigInt
      BigInt(ideaId),                // idea_id
      BigInt(fundingGoalE8s),        // goal (e8s)
      BigInt(endDateSecs)            // end_date (seconds)
    );

    // 6) تعامل مع Result { Ok | Err }
    if ('Err' in createRes) {
      throw new Error(createRes.Err);
    }

    // 7) نجاح → قفلي الديالوج واعملي refetch
    reset();
    setOpen(false);
    onProjectCreated(); // دا بينادي loadCampaigns في الـ App.tsx بالفعل
  } catch (err: any) {
    console.error('Failed to create project/campaign:', err);
    setSubmitError(err?.message ?? 'Failed to create project');
  } finally {
    setIsLoading(false);
  }
};


  const categories = [
    'Technology',
    'Healthcare',
    'Education',
    'Environment',
    'Arts',
    'Sports',
    'Food',
    'Travel',
    'Finance',
    'Other',
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create New Project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Fill in the details below to create a new funding project. This will create an idea that can be turned into a campaign.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Project Title</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Enter project title"
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              {...register('description')}
              placeholder="Describe your project"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fundingGoal">Funding Goal (ICP)</Label>
              <Input
                id="fundingGoal"
                type="number"
                step="0.00000001"
                {...register('fundingGoal')}
                placeholder="0.00"
              />
              {errors.fundingGoal && (
                <p className="text-sm text-red-500">{errors.fundingGoal.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                {...register('category')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-sm text-red-500">{errors.category.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="legalEntity">Legal Entity</Label>
            <Input
              id="legalEntity"
              {...register('legalEntity')}
              placeholder="Company or organization name"
            />
            {errors.legalEntity && (
              <p className="text-sm text-red-500">{errors.legalEntity.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactInfo">Contact Email</Label>
            <Input
              id="contactInfo"
              type="email"
              {...register('contactInfo')}
              placeholder="your@email.com"
            />
            {errors.contactInfo && (
              <p className="text-sm text-red-500">{errors.contactInfo.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessRegistration">Business Registration Number</Label>
            <Input
              id="businessRegistration"
              {...register('businessRegistration')}
              placeholder="Enter registration number"
            />
            {errors.businessRegistration && (
              <p className="text-sm text-red-500">{errors.businessRegistration.message}</p>
            )}
          </div>
              {submitError && (
             <p className="text-sm text-red-500">{submitError}</p>
                )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateProjectDialog;
