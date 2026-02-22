"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowUpRight, Clock, SearchX, Plus, Loader2 } from 'lucide-react';
import type { NewProposalFormData } from '../../components/modals/NewProposalModal';
import NewProposalModal from '../../components/modals/NewProposalModal';
import ProposalDetailModal from '../../components/modals/ProposalDetailModal';
import ConfirmationModal from '../../components/modals/ConfirmationModal';
import ProposalFilters, { type FilterState } from '../../components/proposals/ProposalFilters';
import { useToast } from '../../hooks/useToast';
import { useVaultContract } from '../../hooks/useVaultContract';
import type { TokenBalance } from '../../components/TokenBalanceCard';
import type { TokenInfo } from '../../constants/tokens';
import { DEFAULT_TOKENS, getTokenIcon, formatTokenBalance } from '../../constants/tokens';
import { useWallet } from '../../context/WalletContextProps';

const CopyButton = ({ text }: { text: string }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); }}
    className="p-1 hover:bg-gray-700 rounded text-gray-400"
    aria-label="Copy to clipboard"
  >
    <Clock size={14} />
  </button>
);

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    Pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
    Approved: 'bg-green-500/10 text-green-500 border-green-500/30',
    Rejected: 'bg-red-500/10 text-red-500 border-red-500/30',
    Executed: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colors[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/30'}`}>
      {status}
    </span>
  );
};

// Token badge for proposal cards
const TokenBadge = ({ tokenSymbol }: { tokenSymbol: string }) => {
  const icon = getTokenIcon(tokenSymbol);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-700 text-xs text-gray-300">
      <span>{icon}</span>
      <span>{tokenSymbol}</span>
    </span>
  );
};

export interface Proposal {
  id: string;
  proposer: string;
  recipient: string;
  amount: string;
  token: string;
  tokenSymbol?: string;
  memo: string;
  status: string;
  approvals: number;
  threshold: number;
  createdAt: string;
}

const Proposals: React.FC = () => {
  const { notify } = useToast();
  const { rejectProposal, getTokenBalances, addCustomToken ,loading: contractLoading, proposeTransfer} = useVaultContract();
  const { isConnected, address } = useWallet();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewProposalModal, setShowNewProposalModal] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [selectedTokenFilter, setSelectedTokenFilter] = useState<string>('all');
  const [showTokenFilterDropdown, setShowTokenFilterDropdown] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [activeFilters, setActiveFilters] = useState<FilterState>({
    search: '',
    statuses: [],
    dateRange: { from: '', to: '' },
    amountRange: { min: '', max: '' },
    sortBy: 'newest'
  });

  const [newProposalForm, setNewProposalForm] = useState<NewProposalFormData>({
    recipient: '',
    token: 'NATIVE',
    amount: '',
    memo: '',
  });
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);

  // Fetch token balances
  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const balances = await getTokenBalances();
        setTokenBalances(balances.map(b => ({ ...b, isLoading: false })));
      } catch (error) {
        console.error('Failed to fetch token balances:', error);
        // Set default tokens with zero balances
        setTokenBalances(DEFAULT_TOKENS.map(token => ({
          token,
          balance: '0',
          isLoading: false,
        })));
      }
    };
    fetchBalances();
  }, [getTokenBalances]);

  // Get unique tokens from proposals for filtering
  const availableTokens = useMemo(() => {
    const tokens = new Set(proposals.map(p => p.tokenSymbol || p.token));
    return ['all', ...Array.from(tokens)];
  }, [proposals]);

  // Fetch proposals
  useEffect(() => {
    const fetchProposals = async () => {
      setLoading(true);
      try {
        // Mock data - in production, this would fetch from the contract
        const mockData: Proposal[] = [
          {
            id: '1',
            proposer: 'GABC...XYZ',
            recipient: 'GDEF...UVW',
            amount: '100',
            token: 'NATIVE',
            tokenSymbol: 'XLM',
            memo: 'Liquidity Pool Expansion',
            status: 'Pending',
            approvals: 1,
            threshold: 2,
            createdAt: new Date().toISOString()
          },
          {
            id: '2',
            proposer: '0x789...012',
            recipient: '0xdef...abc',
            amount: '500',
            token: 'CCW67TSZV3SUUJZYHWVPQWJ7B5BODJHYKJRC5QK7L5HHQFJGVY7H3LRL',
            tokenSymbol: 'USDC',
            memo: 'Marketing Campaign Budget',
            status: 'Approved',
            approvals: 3,
            threshold: 3,
            createdAt: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: '3',
            proposer: '0x345...678',
            recipient: '0xghi...jkl',
            amount: '250',
            token: 'NATIVE',
            tokenSymbol: 'XLM',
            memo: 'Community Rewards Distribution',
            status: 'Executed',
            approvals: 3,
            threshold: 3,
            createdAt: new Date(Date.now() - 172800000).toISOString()
          }
        ];
        setProposals(mockData);
      } catch (error) {
        console.error('Failed to fetch proposals:', error);
        notify('config_updated', 'Failed to load proposals', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchProposals();
  }, [notify]);

  // Filter proposals by token and other filters
  const filteredProposals = useMemo(() => {
    const filtered = proposals.filter((p) => {
      // Token filter
      const matchesToken = selectedTokenFilter === 'all' || 
        (p.tokenSymbol || p.token) === selectedTokenFilter;

      // Search filter
      const searchLower = activeFilters.search.toLowerCase();
      const matchesSearch =
        !activeFilters.search ||
        p.proposer.toLowerCase().includes(searchLower) ||
        p.recipient.toLowerCase().includes(searchLower) ||
        p.memo.toLowerCase().includes(searchLower);

      // Status filter
      const matchesStatus =
        activeFilters.statuses.length === 0 || activeFilters.statuses.includes(p.status);

      // Amount filter
      const amount = parseFloat(p.amount.replace(/,/g, ''));
      const min = activeFilters.amountRange.min ? parseFloat(activeFilters.amountRange.min) : -Infinity;
      const max = activeFilters.amountRange.max ? parseFloat(activeFilters.amountRange.max) : Infinity;
      const matchesAmount = amount >= min && amount <= max;

      // Date filter
      const proposalDate = new Date(p.createdAt).getTime();
      const from = activeFilters.dateRange.from ? new Date(activeFilters.dateRange.from).getTime() : -Infinity;
      const to = activeFilters.dateRange.to ? new Date(activeFilters.dateRange.to).setHours(23, 59, 59, 999) : Infinity;
      const matchesDate = proposalDate >= from && proposalDate <= to;

      return matchesToken && matchesSearch && matchesStatus && matchesAmount && matchesDate;
    });

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      const amtA = parseFloat(a.amount.replace(/,/g, ''));
      const amtB = parseFloat(b.amount.replace(/,/g, ''));

      switch (activeFilters.sortBy) {
        case 'oldest': return dateA - dateB;
        case 'highest': return amtB - amtA;
        case 'lowest': return amtA - amtB;
        default: return dateB - dateA;
      }
    });
  }, [proposals, activeFilters, selectedTokenFilter]);

  // Handle proposal submission
  const handleProposalSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!isConnected || !address) {
      setSubmitError('Please connect your wallet to create a proposal');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Convert amount to stroops (smallest unit)
      const amountInStroops = Math.floor(parseFloat(newProposalForm.amount) * 10000000).toString();
      
      // Submit to contract
      const txHash = await proposeTransfer(
        newProposalForm.recipient,
        newProposalForm.token,
        amountInStroops,
        newProposalForm.memo || ''
      );

      // Add new proposal to the list
      const newProposal: Proposal = {
        id: String(proposals.length + 1),
        proposer: `${address.slice(0, 4)}...${address.slice(-4)}`,
        recipient: `${newProposalForm.recipient.slice(0, 4)}...${newProposalForm.recipient.slice(-4)}`,
        amount: newProposalForm.amount,
        token: newProposalForm.token === 'NATIVE' ? 'XLM' : newProposalForm.token,
        memo: newProposalForm.memo || 'No memo',
        status: 'Pending',
        approvals: 0,
        threshold: 2,
        createdAt: new Date().toISOString()
      };

      setProposals(prev => [newProposal, ...prev]);
      
      // Reset form and close modal
      setNewProposalForm({
        recipient: '',
        token: 'NATIVE',
        amount: '',
        memo: '',
      });
      setShowNewProposalModal(false);
      
      notify('new_proposal', `Proposal created successfully! TX: ${txHash?.slice(0, 8)}...`, 'success');
    } catch (err: unknown) {
      console.error('Failed to create proposal:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to create proposal. Please try again.';
      setSubmitError(errorMessage);
      notify('new_proposal', errorMessage, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [isConnected, address, newProposalForm, proposals.length, proposeTransfer, notify]);

  // Handle reject confirmation
  const handleRejectConfirm = useCallback(async () => {
    if (!rejectingId) return;
    
    try {
      await rejectProposal(Number(rejectingId));
      setProposals(prev => prev.map(p => p.id === rejectingId ? { ...p, status: 'Rejected' } : p));
      notify('proposal_rejected', `Proposal #${rejectingId} rejected`, 'success');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reject';
      notify('proposal_rejected', errorMessage, 'error');
    } finally {
      setShowRejectModal(false);
      setRejectingId(null);
    }
  }, [rejectingId, rejectProposal, notify]);

  // Handle field change
  const handleFieldChange = useCallback((field: keyof NewProposalFormData, value: string) => {
    setNewProposalForm(prev => ({ ...prev, [field]: value }));
    setSubmitError(null); // Clear error when user makes changes
  }, []);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    if (!isSubmitting) {
      setShowNewProposalModal(false);
      setSubmitError(null);
      setNewProposalForm({
        recipient: '',
        token: 'NATIVE',
        amount: '',
        memo: '',
      });
    }
  }, [isSubmitting]);

  // Handle template selector (placeholder)
  const handleOpenTemplateSelector = useCallback(() => {
    // TODO: Implement template selector modal
    notify('config_updated', 'Template selector coming soon!', 'info');
  }, [notify]);

  // Handle save as template (placeholder)
  const handleSaveAsTemplate = useCallback(() => {
    // TODO: Implement save as template functionality
    notify('config_updated', 'Template saved successfully!', 'success');
  }, [notify]);

  const handleTokenSelect = (token: TokenInfo) => {
    setNewProposalForm(prev => ({ ...prev, token: token.address }));
    setSelectedToken(token);
  };

  // Find the selected token balance
  const selectedTokenBalance = useMemo(() => {
    if (!selectedToken) return null;
    return tokenBalances.find(tb => tb.token.address === selectedToken.address);
  }, [tokenBalances, selectedToken]);

  // Compute amount error
  const amountError = useMemo(() => {
    if (newProposalForm.amount && selectedTokenBalance) {
      const amount = parseFloat(newProposalForm.amount);
      const balance = parseFloat(selectedTokenBalance.balance);
      
      if (isNaN(amount)) {
        return 'Please enter a valid amount';
      } else if (amount <= 0) {
        return 'Amount must be greater than 0';
      } else if (amount > balance) {
        return `Insufficient balance. Available: ${formatTokenBalance(balance, selectedTokenBalance.token.decimals)} ${selectedTokenBalance.token.symbol}`;
      }
    }
    return null;
  }, [newProposalForm.amount, selectedTokenBalance]);

  // Initialize selected token when tokenBalances load
  useEffect(() => {
    if (!selectedToken && tokenBalances.length > 0) {
      const xlmToken = tokenBalances.find(tb => tb.token.address === 'NATIVE');
      if (xlmToken) {
        setSelectedToken(xlmToken.token);
      } else {
        setSelectedToken(tokenBalances[0].token);
      }
    }
  }, [selectedToken, tokenBalances]);

  const handleAddCustomToken = async (address: string): Promise<TokenInfo | null> => {
    try {
      const tokenInfo = await addCustomToken(address);
      if (tokenInfo) {
        // Refresh token balances
        const balances = await getTokenBalances();
        setTokenBalances(balances.map(b => ({ ...b, isLoading: false })));
      }
      return tokenInfo;
    } catch (error) {
      console.error('Failed to add custom token:', error);
      throw error;
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6 text-white">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold">Proposals</h1>
          <button 
            onClick={() => setShowNewProposalModal(true)} 
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 px-6 py-2.5 rounded-lg transition min-h-[44px]"
          >
            New Proposal
          </button>
        </div>

        {/* Token Filter Bar */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-400">Filter by token:</span>
          <div className="relative">
            <button
              onClick={() => setShowTokenFilterDropdown(!showTokenFilterDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 hover:border-purple-500/50 transition-colors"
            >
              <span>{selectedTokenFilter === 'all' ? 'All Tokens' : selectedTokenFilter}</span>
              <ChevronDown size={16} className={`transition-transform ${showTokenFilterDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {showTokenFilterDropdown && (
              <div className="absolute z-20 mt-2 left-0 min-w-[150px] bg-gray-800 border border-gray-700 rounded-lg shadow-xl overflow-hidden">
                {availableTokens.map((token) => (
                  <button
                    key={token}
                    onClick={() => {
                      setSelectedTokenFilter(token);
                      setShowTokenFilterDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-700 transition-colors ${
                      selectedTokenFilter === token ? 'bg-purple-600/20 text-purple-300' : 'text-gray-300'
                    }`}
                  >
                    {token === 'all' ? 'All Tokens' : (
                      <span className="flex items-center gap-2">
                        <span>{getTokenIcon(token)}</span>
                        <span>{token}</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {selectedTokenFilter !== 'all' && (
            <button
              onClick={() => setSelectedTokenFilter('all')}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Clear filter
            </button>
          )}
        </div>

        <ProposalFilters proposalCount={filteredProposals.length} onFilterChange={setActiveFilters} />

        <div className="mt-6 grid grid-cols-1 gap-4">
          {filteredProposals.length > 0 ? (
            filteredProposals.map((prop) => (
              <div 
                key={prop.id} 
                onClick={() => setSelectedProposal(prop)} 
                className="bg-gray-800/50 p-4 sm:p-5 rounded-2xl border border-gray-700 hover:border-purple-500/50 cursor-pointer transition-all hover:scale-[1.01] group"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="p-2.5 sm:p-3 bg-gray-900 rounded-xl text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors flex-shrink-0">
                      <ArrowUpRight size={18} className="sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-white font-bold">Proposal #{prop.id}</h4>
                        <TokenBadge tokenSymbol={prop.tokenSymbol || prop.token} />
                        <CopyButton text={prop.recipient} />
                      </div>
                      <p className="text-sm text-gray-400 truncate max-w-[200px] sm:max-w-md">{prop.memo}</p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> 
                          {new Date(prop.createdAt).toLocaleDateString()}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="font-medium text-gray-300">
                          {prop.amount} {prop.tokenSymbol || 'tokens'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <StatusBadge status={prop.status} />
                    {prop.status === 'Pending' && (
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setRejectingId(prop.id); 
                          setShowRejectModal(true); 
                        }} 
                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs transition-colors"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 bg-gray-800/20 rounded-3xl border border-dashed border-gray-700">
                <SearchX size={48} className="text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg font-medium">No proposals match your filters</p>
                <p className="text-gray-500 text-sm mt-2">Try adjusting your search criteria</p>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 bg-gray-800/20 rounded-3xl border border-dashed border-gray-700">
              <SearchX size={48} className="text-gray-600 mb-4" />
              <p className="text-gray-400 text-lg font-medium">No proposals match your filters</p>
              {selectedTokenFilter !== 'all' && (
                <button
                  onClick={() => setSelectedTokenFilter('all')}
                  className="mt-2 text-sm text-purple-400 hover:text-purple-300"
                >
                  Clear token filter
                </button>
              )}
            </div>
          )}
        </div>

        {/* New Proposal Modal */}
        <NewProposalModal 
          isOpen={showNewProposalModal} 
          loading={loading} 
          selectedTemplateName={null}
          formData={newProposalForm}
          tokenBalances={tokenBalances}
          selectedToken={selectedToken}
          amountError={amountError}
          onFieldChange={(f, v) => setNewProposalForm(prev => ({ ...prev, [f]: v }))} 
          onSubmit={(e) => { e.preventDefault(); setShowNewProposalModal(false); }} 
          onTokenSelect={handleTokenSelect}
          onOpenTemplateSelector={() => {}} 
          onSaveAsTemplate={() => {}} 
          onClose={() => setShowNewProposalModal(false)}
          onAddCustomToken={handleAddCustomToken}
        />
        <ProposalDetailModal isOpen={!!selectedProposal} onClose={() => setSelectedProposal(null)} proposal={selectedProposal} />
        <ConfirmationModal 
          isOpen={showRejectModal} 
          title="Reject Proposal" 
          message="Are you sure you want to reject this?" 
          onConfirm={handleRejectConfirm} 
          onCancel={() => setShowRejectModal(false)} 
          showReasonInput={true} 
          isDestructive={true} 
        />
      </div>
    </div>
  );
};

export default Proposals;
