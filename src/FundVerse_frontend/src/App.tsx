import React, { useState, useEffect } from 'react';
import { Button } from './components/ui/button';
import CampaignCard from './components/CampaignCard';
import CreateProjectDialog from './components/CreateProjectDialog';
import ContributionDialog from './components/ContributionDialog';
import Dashboard from './components/Dashboard';
import { 
  createFundVerseBackendActor, 
  createFundFlowActor, 
  login, 
  logout,
  isAuthenticated,
  getPrincipal,
  getConnectionStatus,
  handleICError,
  type FundVerseBackendService,
  type FundFlowService
} from './lib/ic';
import { 
  Wallet, 
  LogOut, 
  BarChart3, 
  Grid, 
  Zap, 
  Globe,
  User,
  Copy,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import type { ActorSubclass } from "@dfinity/agent";
import type { Principal } from "@dfinity/principal";

interface Campaign {
  id: bigint;
  title: string;
  goal: bigint;
  amount_raised: bigint;
  end_date: bigint;
  days_left: bigint;
  category: string;
  idea_id: bigint;
}

function App() {
  const [backendActor, setBackendActor] = useState<ActorSubclass<FundVerseBackendService> | null>(null);
  const [fundFlowActor, setFundFlowActor] = useState<ActorSubclass<FundFlowService> | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userPrincipal, setUserPrincipal] = useState<Principal | null>(null);
  const [view, setView] = useState<'grid' | 'dashboard'>('grid');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contributionDialog, setContributionDialog] = useState<{
    open: boolean;
    campaignId: bigint;
    campaignTitle: string;
  }>({
    open: false,
    campaignId: BigInt(0),
    campaignTitle: '',
  });
  const [refreshing, setRefreshing] = useState(false);

  // Initialize app and check authentication
  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const { connected, principal } = await getConnectionStatus();
        setAuthenticated(connected);
        setUserPrincipal(principal);

        if (connected) {
          await initializeActors();
        }
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setError('Failed to initialize application');
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  // Initialize actors
  const initializeActors = async () => {
    try {
      const [backend, fundFlow] = await Promise.all([
        createFundVerseBackendActor(),
        createFundFlowActor()
      ]);
      
      setBackendActor(backend);
      setFundFlowActor(fundFlow);
    } catch (error) {
      console.error('Failed to initialize actors:', error);
      throw error;
    }
  };

  // Load campaigns when backend actor is available
  useEffect(() => {
    if (backendActor && authenticated) {
      loadCampaigns();
    }
  }, [backendActor, authenticated]);

  const loadCampaigns = async () => {
    if (!backendActor) return;

    try {
      setRefreshing(true);
      setError(null);
      const campaignCards = await backendActor.get_campaign_cards();
      setCampaigns(campaignCards as Campaign[]);
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      const icError = handleICError(error);
      setError(`Failed to load campaigns: ${icError.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogin = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      
      const success = await login();
      if (success) {
        const principal = await getPrincipal();
        setAuthenticated(true);
        setUserPrincipal(principal);
        
        // Initialize actors after successful login
        await initializeActors();
      }
    } catch (error) {
      console.error('Login failed:', error);
      const icError = handleICError(error);
      setError(`Login failed: ${icError.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleLogout = async () => {
    try {
      setError(null);
      await logout();
      setAuthenticated(false);
      setUserPrincipal(null);
      setBackendActor(null);
      setFundFlowActor(null);
      setCampaigns([]);
    } catch (error) {
      console.error('Logout failed:', error);
      const icError = handleICError(error);
      setError(`Logout failed: ${icError.message}`);
    }
  };

  const handleContribute = (campaignId: bigint) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (campaign) {
      setContributionDialog({
        open: true,
        campaignId,
        campaignTitle: campaign.title,
      });
    }
  };

  const handleContributionSuccess = () => {
    loadCampaigns(); // Refresh campaigns after contribution
    setContributionDialog(prev => ({ ...prev, open: false }));
  };

  const handleProjectCreated = () => {
    loadCampaigns(); // Refresh campaigns after project creation
  };

  const copyPrincipal = async () => {
    if (userPrincipal) {
      try {
        await navigator.clipboard.writeText(userPrincipal.toString());
      } catch (error) {
        console.error('Failed to copy principal:', error);
      }
    }
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen web3-bg flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="relative">
            <div className="animate-pulse-glow rounded-full h-32 w-32 web3-gradient mx-auto flex items-center justify-center">
              <Zap className="h-16 w-16 text-white animate-float" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold web3-gradient-text">FundVerse</h1>
            <p className="text-xl text-muted-foreground">Initializing Web3 Platform...</p>
          </div>
        </div>
      </div>
    );
  }

  // Authentication screen
  if (!authenticated) {
    return (
      <div className="min-h-screen web3-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center space-y-6">
            <div className="relative">
              <div className="rounded-full h-24 w-24 web3-gradient mx-auto flex items-center justify-center glow-purple">
                <Globe className="h-12 w-12 text-white" />
              </div>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-5xl font-bold web3-gradient-text neon-text">
                FundVerse
              </h1>
              <p className="text-xl text-muted-foreground">
                Decentralized Funding Platform
              </p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Connect with Internet Identity to start funding innovative projects with ICP coins on the Internet Computer
              </p>
            </div>

            {error && (
              <div className="web3-card p-4 border-red-500/20 bg-red-500/10">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <Button 
                onClick={handleLogin} 
                disabled={isConnecting}
                className="w-full btn-web3-primary h-12 text-lg"
              >
                {isConnecting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="h-5 w-5 mr-3" />
                    Connect with Internet Identity
                  </>
                )}
              </Button>
              
              <div className="flex items-center justify-center space-x-4 text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-3 w-3 text-green-400" />
                  <span>Secure</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-3 w-3 text-green-400" />
                  <span>Decentralized</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-3 w-3 text-green-400" />
                  <span>Anonymous</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen web3-bg">
      {/* Header */}
      <header className="border-b border-white/10 web3-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="rounded-full h-10 w-10 web3-gradient flex items-center justify-center">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold web3-gradient-text">FundVerse</h1>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant={view === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('grid')}
                  className={view === 'grid' ? 'btn-web3-primary' : 'btn-web3-secondary'}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === 'dashboard' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('dashboard')}
                  className={view === 'dashboard' ? 'btn-web3-primary' : 'btn-web3-secondary'}
                >
                  <BarChart3 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* User Info */}
              {userPrincipal && (
                <div className="flex items-center space-x-2 web3-card px-3 py-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-mono">
                    {userPrincipal.toString().slice(0, 8)}...{userPrincipal.toString().slice(-4)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyPrincipal}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={loadCampaigns}
                disabled={refreshing}
                className="btn-web3-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>

              {backendActor && (
                <CreateProjectDialog
                  backendActor={backendActor}
                  onProjectCreated={handleProjectCreated}
                />
              )}
              
              <Button 
                variant="outline" 
                onClick={handleLogout} 
                className="btn-web3-secondary flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="container mx-auto px-4 py-4">
          <div className="web3-card p-4 border-red-500/20 bg-red-500/10">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {view === 'dashboard' ? (
          <Dashboard campaigns={campaigns} />
        ) : (
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center space-y-4">
              <h2 className="text-4xl font-bold web3-gradient-text">
                Discover Innovation
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Fund the future with ICP. Support groundbreaking projects on the Internet Computer.
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold">Active Campaigns</h3>
                <p className="text-muted-foreground">
                  Discover and fund innovative projects with ICP
                </p>
              </div>
              <div className="text-right web3-card p-4">
                <p className="text-3xl font-bold web3-gradient-text">{campaigns.length}</p>
                <p className="text-sm text-muted-foreground">Total Campaigns</p>
              </div>
            </div>

            {/* Campaigns Grid */}
            {campaigns.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto w-32 h-32 web3-card rounded-full flex items-center justify-center mb-6 glow-purple">
                  <BarChart3 className="h-16 w-16 text-muted-foreground animate-float" />
                </div>
                <h3 className="text-2xl font-semibold mb-4 web3-gradient-text">No campaigns yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Be the first to create a funding campaign and start building the future!
                </p>
                {backendActor && (
                  <CreateProjectDialog
                    backendActor={backendActor}
                    onProjectCreated={handleProjectCreated}
                  />
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {campaigns.map((campaign) => (
                  <CampaignCard
                    key={campaign.id.toString()}
                    campaign={campaign}
                    fundFlowActor={fundFlowActor!}
                    backendActor={backendActor!}
                    onContribute={handleContribute}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Contribution Dialog */}
      {contributionDialog.open && fundFlowActor && backendActor && (
        <ContributionDialog
          open={contributionDialog.open}
          onOpenChange={(open) => setContributionDialog(prev => ({ ...prev, open }))}
          campaignId={contributionDialog.campaignId}
          campaignTitle={contributionDialog.campaignTitle}
          fundFlowActor={fundFlowActor}
          backendActor={backendActor}
          onContributionSuccess={handleContributionSuccess}
        />
      )}
    </div>
  );
}

export default App;