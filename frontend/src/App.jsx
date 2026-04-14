import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import {
  RainbowKitProvider,
  ConnectButton,
  getDefaultConfig,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount, useWriteContract } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hardhat } from 'wagmi/chains';
import '@rainbow-me/rainbowkit/styles.css';
import './App.css';
import ReliefChainABI from './ReliefChainABI.json';

// ─── Wagmi config for local Hardhat ──────────────────────────────────────────
// projectId is intentionally a local placeholder; WalletConnect is not used
// in the demo — MetaMask injected provider is the only required wallet.
const config = getDefaultConfig({
  appName: 'ReliefChain',
  projectId: 'reliefchain-local-demo',
  chains: [hardhat],
});

const queryClient = new QueryClient();

// Reads from Vite env var; falls back to the currently-deployed local address
const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9';

// ─── Status badge helper ──────────────────────────────────────────────────────
function StatusBadge({ paid, approved }) {
  if (paid)
    return <span className="badge badge-paid">Paid</span>;
  if (approved)
    return <span className="badge badge-approved">Approved</span>;
  return <span className="badge badge-pending">Pending</span>;
}

// ─── Main app content (requires wallet context) ───────────────────────────────
function AppContent() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [campaignName, setCampaignName] = useState('');
  const [totalDonations, setTotalDonations] = useState('0');
  const [contractBalance, setContractBalance] = useState('0');
  const [requests, setRequests] = useState([]);
  const [donationAmount, setDonationAmount] = useState('');
  const [requestAmount, setRequestAmount] = useState('');
  const [evidenceCID, setEvidenceCID] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // ── Load on-chain data ──────────────────────────────────────────────────────
  const loadContractData = async () => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        ReliefChainABI,
        provider
      );

      const [name, donations, balance, nextId] = await Promise.all([
        contract.campaignName(),
        contract.totalDonations(),
        provider.getBalance(CONTRACT_ADDRESS),
        contract.nextRequestId(),
      ]);

      setCampaignName(name);
      setTotalDonations(ethers.formatEther(donations));
      setContractBalance(ethers.formatEther(balance));

      const reqs = [];
      for (let i = 0; i < Number(nextId); i++) {
        try {
          const req = await contract.getRequestDetails(i);
          reqs.push({
            id: i,
            organizer: req[1],
            amount: ethers.formatEther(req[2]),
            evidenceCID: req[3],
            // req[4] is BigInt in ethers v6 — must use Number()
            approvals: Number(req[4]),
            approved: req[5],
            paid: req[6],
          });
        } catch (err) {
          console.error(`Failed to fetch request ${i}:`, err);
        }
      }
      setRequests(reqs.reverse());
    } catch (err) {
      console.error('Error loading contract data:', err);
    }
  };

  useEffect(() => {
    loadContractData();
    const interval = setInterval(loadContractData, 10000);
    return () => clearInterval(interval);
  }, [isConnected]);

  // ── Transaction helpers ─────────────────────────────────────────────────────
  const notify = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 5000);
  };

  const handleDonate = async () => {
    if (!donationAmount) return;
    setLoading(true);
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ReliefChainABI,
        functionName: 'donate',
        value: ethers.parseEther(donationAmount),
        gasLimit: 500000n,
      });
      notify('Donation successful!');
      setDonationAmount('');
      loadContractData();
    } catch (err) {
      console.error(err);
      notify('Donation failed: ' + (err.shortMessage || err.message));
    }
    setLoading(false);
  };

  const handleSubmitRequest = async () => {
    if (!requestAmount || !evidenceCID) return;
    setLoading(true);
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ReliefChainABI,
        functionName: 'submitRequest',
        args: [ethers.parseEther(requestAmount), evidenceCID],
        gasLimit: 500000n,
      });
      notify('Request submitted successfully!');
      setRequestAmount('');
      setEvidenceCID('');
      loadContractData();
    } catch (err) {
      console.error(err);
      notify('Submit failed: ' + (err.shortMessage || err.message));
    }
    setLoading(false);
  };

  const handleVote = async (approve) => {
    if (!selectedRequestId) return;
    setLoading(true);
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ReliefChainABI,
        functionName: 'voteOnRequest',
        args: [selectedRequestId, approve],
        gasLimit: 500000n,
      });
      notify(`Vote cast: ${approve ? 'Approved' : 'Rejected'}`);
      loadContractData();
    } catch (err) {
      console.error(err);
      notify('Vote failed: ' + (err.shortMessage || err.message));
    }
    setLoading(false);
  };

  const handleClaim = async (id) => {
    setLoading(true);
    try {
      await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ReliefChainABI,
        functionName: 'claimApprovedFunds',
        args: [id],
        gasLimit: 500000n,
      });
      notify('Funds claimed successfully!');
      loadContractData();
    } catch (err) {
      console.error(err);
      notify('Claim failed: ' + (err.shortMessage || err.message));
    }
    setLoading(false);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <span className="header-logo">⛓</span>
            <div>
              <h1 className="header-title">ReliefChain</h1>
              <p className="header-subtitle">
                {campaignName || 'Blockchain Transparency for Disaster Aid'}
              </p>
            </div>
          </div>
          <ConnectButton />
        </div>
      </header>

      <main className="main">
        {/* ── Status toast ── */}
        {statusMsg && (
          <div className="toast">{statusMsg}</div>
        )}

        {!isConnected ? (
          /* ── Not connected ── */
          <div className="hero">
            <div className="hero-icon">🌏</div>
            <h2 className="hero-title">Transparent Disaster Aid for Vietnam</h2>
            <p className="hero-desc">
              ReliefChain records every donation, reimbursement request, and
              validator vote on-chain. Connect your wallet to participate.
            </p>
            <div className="hero-steps">
              <div className="step">
                <span className="step-num">1</span>
                <span>Donors fund the campaign</span>
              </div>
              <div className="step">
                <span className="step-num">2</span>
                <span>Organizers submit requests with IPFS evidence</span>
              </div>
              <div className="step">
                <span className="step-num">3</span>
                <span>Validators vote 2-of-3 to approve</span>
              </div>
              <div className="step">
                <span className="step-num">4</span>
                <span>Funds release automatically on approval</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Stats dashboard ── */}
            <section className="stats-grid">
              <div className="stat-card">
                <p className="stat-label">Your Address</p>
                <p className="stat-value mono">
                  {address.slice(0, 6)}…{address.slice(-4)}
                </p>
              </div>
              <div className="stat-card accent">
                <p className="stat-label">Total Donated</p>
                <p className="stat-value">{parseFloat(totalDonations).toFixed(4)} ETH</p>
              </div>
              <div className="stat-card accent">
                <p className="stat-label">Contract Balance</p>
                <p className="stat-value">{parseFloat(contractBalance).toFixed(4)} ETH</p>
              </div>
              <div className="stat-card">
                <p className="stat-label">Requests</p>
                <p className="stat-value">{requests.length}</p>
              </div>
            </section>

            {/* ── Action cards ── */}
            <section className="action-grid">

              {/* Donate */}
              <div className="card">
                <div className="card-header">
                  <span className="card-icon">💚</span>
                  <h2 className="card-title">Make a Donation</h2>
                </div>
                <p className="card-desc">
                  Send ETH/MATIC to the campaign. Every donation is recorded
                  on-chain instantly.
                </p>
                <div className="input-row">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount in ETH"
                    value={donationAmount}
                    onChange={(e) => setDonationAmount(e.target.value)}
                    className="input"
                  />
                  <button
                    onClick={handleDonate}
                    disabled={loading || !donationAmount}
                    className="btn btn-primary"
                  >
                    {loading ? <span className="spinner" /> : 'Donate'}
                  </button>
                </div>
              </div>

              {/* Submit Request */}
              <div className="card">
                <div className="card-header">
                  <span className="card-icon">📋</span>
                  <h2 className="card-title">Submit Reimbursement Request</h2>
                </div>
                <p className="card-desc">
                  Organizers: upload your evidence to IPFS (e.g. via Pinata),
                  then submit the CID here.
                </p>
                <div className="input-col">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Requested amount in ETH"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    className="input"
                  />
                  <input
                    type="text"
                    placeholder="IPFS CID (e.g. QmXyZ...)"
                    value={evidenceCID}
                    onChange={(e) => setEvidenceCID(e.target.value)}
                    className="input"
                  />
                  <button
                    onClick={handleSubmitRequest}
                    disabled={loading || !requestAmount || !evidenceCID}
                    className="btn btn-primary"
                  >
                    {loading ? <span className="spinner" /> : 'Submit Request'}
                  </button>
                </div>
              </div>

              {/* Validator */}
              <div className="card">
                <div className="card-header">
                  <span className="card-icon">🗳</span>
                  <h2 className="card-title">Validator Actions</h2>
                </div>
                <p className="card-desc">
                  Validators: select a request, review its IPFS evidence, then
                  cast your vote. 2-of-3 approvals releases the funds.
                </p>
                <div className="input-col">
                  <select
                    value={selectedRequestId}
                    onChange={(e) => setSelectedRequestId(e.target.value)}
                    className="input"
                  >
                    <option value="">Select request ID…</option>
                    {requests.map((req) => (
                      <option key={req.id} value={req.id}>
                        #{req.id} — {req.amount} ETH
                        {req.approved ? ' ✔' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="vote-row">
                    <button
                      onClick={() => handleVote(true)}
                      disabled={loading || !selectedRequestId}
                      className="btn btn-approve"
                    >
                      {loading ? <span className="spinner" /> : '✔ Approve'}
                    </button>
                    <button
                      onClick={() => handleVote(false)}
                      disabled={loading || !selectedRequestId}
                      className="btn btn-reject"
                    >
                      {loading ? <span className="spinner" /> : '✘ Reject'}
                    </button>
                  </div>
                </div>
              </div>

            </section>

            {/* ── Requests table ── */}
            <section className="card table-card">
              <div className="card-header">
                <span className="card-icon">📊</span>
                <h2 className="card-title">Reimbursement Requests</h2>
              </div>

              {requests.length === 0 ? (
                <p className="empty-msg">No requests yet. Organizers can submit one above.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Organizer</th>
                        <th>Amount (ETH)</th>
                        <th>Evidence</th>
                        <th>Votes</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((req) => (
                        <tr key={req.id}>
                          <td className="mono">#{req.id}</td>
                          <td className="mono">
                            {req.organizer.slice(0, 6)}…{req.organizer.slice(-4)}
                          </td>
                          <td>{req.amount}</td>
                          <td>
                            <a
                              href={`https://ipfs.io/ipfs/${req.evidenceCID}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link"
                            >
                              View ↗
                            </a>
                          </td>
                          <td>
                            <span className={`vote-count ${req.approvals >= 2 ? 'vote-met' : ''}`}>
                              {req.approvals}/3
                            </span>
                          </td>
                          <td>
                            <StatusBadge paid={req.paid} approved={req.approved} />
                          </td>
                          <td>
                            {req.approved && !req.paid && (
                              <button
                                onClick={() => handleClaim(req.id)}
                                disabled={loading}
                                className="btn btn-sm btn-claim"
                              >
                                Claim
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ── Footer note ── */}
            <footer className="footer">
              <p>
                Contract:{' '}
                <span className="mono">{CONTRACT_ADDRESS}</span>
                {' · '}
                All transactions are publicly verifiable on-chain.
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

// ─── Root wrapper ─────────────────────────────────────────────────────────────
function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <AppContent />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
