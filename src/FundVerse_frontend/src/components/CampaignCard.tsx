import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { formatCurrency, calculateProgress, getDaysLeft, truncateAddress } from '../lib/utils';
import { FUND_FLOW_CANISTER_ID_STR } from '../lib/ic';
import { Copy, ExternalLink, TrendingUp, Clock, Target, Zap, CheckCircle } from 'lucide-react';

interface CampaignCardProps {
  campaign: {
    id: bigint;
    title: string;
    goal: bigint;
    amount_raised: bigint;
    end_date: bigint;
    days_left: bigint;
    category: string;
    idea_id: bigint;
  };
  fundFlowActor: any;
  backendActor: any;
  onContribute: (campaignId: bigint) => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  fundFlowActor,
  backendActor,
  onContribute,
}) => {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const progress = calculateProgress(campaign.amount_raised, campaign.goal);
  const daysLeft = getDaysLeft(campaign.end_date);
  const isActive = daysLeft > 0;
  const isFunded = campaign.amount_raised >= campaign.goal;

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(FUND_FLOW_CANISTER_ID_STR);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const getStatusBadge = () => {
    if (!isActive) {
      return <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/30">Ended</Badge>;
    }
    if (isFunded) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 glow-green">Funded</Badge>;
    }
    return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">Active</Badge>;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      'Technology': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      'Healthcare': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Education': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Environment': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      'Arts': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      'Sports': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Food': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Travel': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'Finance': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    };
    return colors[category as keyof typeof colors] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  return (
    <Card className="web3-card hover:glow-purple transition-all duration-300 group">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <CardTitle className="text-xl font-bold line-clamp-2 group-hover:web3-gradient-text transition-all duration-300">
              {campaign.title}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={getCategoryColor(campaign.category)}>
                {campaign.category}
              </Badge>
              {getStatusBadge()}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Funding Progress */}
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" />
              Progress
            </span>
            <span className="font-bold web3-gradient-text">{progress.toFixed(1)}%</span>
          </div>
          
          <div className="relative">
            <Progress value={progress} className="h-3 bg-muted/20" />
            <div 
              className="absolute top-0 left-0 h-3 web3-progress rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm">
            <div className="text-muted-foreground">
              <span className="text-white font-semibold">
                {formatCurrency(Number(campaign.amount_raised) / 100_000_000)}
              </span>
              <span className="ml-1">raised</span>
            </div>
            <div className="text-muted-foreground">
              <span>Goal: </span>
              <span className="text-white font-semibold">
                {formatCurrency(Number(campaign.goal) / 100_000_000)}
              </span>
            </div>
          </div>
        </div>

        {/* Campaign Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="web3-card p-3 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              Campaign ID
            </div>
            <p className="font-mono text-sm text-white">#{campaign.id.toString()}</p>
          </div>
          
          <div className="web3-card p-3 space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Time Left
            </div>
            <p className={`text-sm font-semibold ${daysLeft > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {daysLeft > 0 ? `${daysLeft} days` : 'Ended'}
            </p>
          </div>
        </div>

        {/* Deposit Address */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Target className="h-3 w-3" />
              Deposit Address
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyAddress}
              className="h-6 w-6 p-0 hover:bg-white/10"
            >
              {copied ? (
                <CheckCircle className="h-3 w-3 text-green-400" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          </div>
          <div className="web3-card p-3 text-xs font-mono break-all text-muted-foreground">
            {truncateAddress(FUND_FLOW_CANISTER_ID_STR, 12)}
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex gap-3 pt-6">
        <Button
          onClick={() => onContribute(campaign.id)}
          disabled={!isActive}
          className="flex-1 btn-web3-primary group-hover:glow-purple"
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          {isFunded ? 'Funded' : 'Contribute ICP'}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          className="btn-web3-secondary"
          onClick={() => navigate(`/campaign/${campaign.id.toString()}`)}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default CampaignCard;
