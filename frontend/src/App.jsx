import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { RainbowKitProvider, ConnectButton, getDefaultConfig } from '@rainbow-me/rainbowkit';
import { WagmiProvider, useAccount, useWriteContract } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { hardhat } from 'wagmi/chains';
import '@rainbow-me/rainbowkit/styles.css';
import ReliefChainABI from './ReliefChainABI.json';

// Wagmi config for local Hardhat
const config = getDefaultConfig({
  appName: 'ReliefChain',
  projectId: 'reliefchain-local',
  chains: [hardhat],
});

const queryClient = new QueryClient();

const contractAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
function AppContent() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [campaignName, setCampaignName] = useState('');
  const [totalDonations, setTotalDonations] = useState('0');
  const [contractBalance, setContractBalance] = useState('0');
  const [donationAmount, setDonationAmount] = useState('');
  const [requests, setRequests] = useState([]);
  const [requestAmount, setRequestAmount] = useState('');
  const [evidenceCID, setEvidenceCID] = useState('');
  const [selectedRequestId, setSelectedRequestId] = useState('');
  const [loading, setLoading] = useState(false);

  const loadContractData = async () => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, ReliefChainABI, provider);

      const name = await contract.campaignName();
      const donations = await contract.totalDonations();
      const balance = await provider.getBalance(contractAddress);
      const nextId = await contract.nextRequestId();

      setCampaignName(name);
      setTotalDonations(ethers.formatEther(donations));
      setContractBalance(ethers.formatEther(balance));

      console.log("Next request ID:", nextId.toString());

      const reqs = [];
      for (let i = 0; i < Number(nextId); i++) {
        try {
          const req = await contract.getRequestDetails(i);
          reqs.push({
            id: i,
            organizer: req[1],
            amount: ethers.formatEther(req[2]),
            evidenceCID: req[3],
            approvals: req[4].toNumber(),
            approved: req[5],
            paid: req[6],
          });
        } catch (err) {
          console.error(`Failed to fetch request ${i}:`, err);
        }
      }
      setRequests(reqs.reverse());
    } catch (err) {
      console.error('Top-level error in loadContractData:', err);
    }
  };

  useEffect(() => {
    loadContractData();
    const interval = setInterval(loadContractData, 10000);
    return () => clearInterval(interval);
  }, [isConnected]);

  const handleDonate = async () => {
    if (!donationAmount) return;
    setLoading(true);
    try {
      await writeContractAsync({
        address: contractAddress,
        abi: ReliefChainABI,
        functionName: 'donate',
        value: ethers.parseEther(donationAmount),
        gasLimit: 500000n,
      });
      alert('Donation successful!');
      setDonationAmount('');
      loadContractData();
    } catch (err) {
      console.error(err);
      alert('Donation failed: ' + err.message);
    }
    setLoading(false);
  };

  const handleSubmitRequest = async () => {
    if (!requestAmount || !evidenceCID) return;
    setLoading(true);
    try {
      await writeContractAsync({
        address: contractAddress,
        abi: ReliefChainABI,
        functionName: 'submitRequest',
        args: [ethers.parseEther(requestAmount), evidenceCID],
        gasLimit: 500000n,
      });
      alert('Request submitted!');
      setRequestAmount('');
      setEvidenceCID('');
      loadContractData();
    } catch (err) {
      console.error(err);
      alert('Submit failed: ' + err.message);
    }
    setLoading(false);
  };

  const handleVote = async (approve) => {
    if (!selectedRequestId) return;
    setLoading(true);
    try {
      await writeContractAsync({
        address: contractAddress,
        abi: ReliefChainABI,
        functionName: 'voteOnRequest',
        args: [selectedRequestId, approve],
        gasLimit: 500000n,
      });
      alert('Vote cast!');
      loadContractData();
    } catch (err) {
      console.error(err);
      alert('Vote failed: ' + err.message);
    }
    setLoading(false);
  };

  const handleClaim = async (id) => {
    setLoading(true);
    try {
      await writeContractAsync({
        address: contractAddress,
        abi: ReliefChainABI,
        functionName: 'claimApprovedFunds',
        args: [id],
        gasLimit: 500000n,
      });
      alert('Funds claimed!');
      loadContractData();
    } catch (err) {
      console.error(err);
      alert('Claim failed: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>{campaignName || 'ReliefChain'}</h1>
        <ConnectButton />
      </div>

      {!isConnected ? (
        <p>Connect your wallet to participate.</p>
      ) : (
        <>
          <div style={{ background: '#f0f0f0', padding: '15px', borderRadius: '8px', margin: '20px 0' }}>
            <p><strong>Your Address:</strong> {address}</p>
            <p><strong>Total Donations:</strong> {totalDonations} ETH</p>
            <p><strong>Contract Balance:</strong> {contractBalance} ETH</p>
          </div>

          {/* Donation Section */}
          <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h2>Make a Donation</h2>
            <input
              type="number"
              step="0.01"
              placeholder="Amount in ETH"
              value={donationAmount}
              onChange={(e) => setDonationAmount(e.target.value)}
              style={{ padding: '8px', marginRight: '10px', width: '200px' }}
            />
            <button onClick={handleDonate} disabled={loading} style={{ padding: '8px 16px' }}>
              Donate
            </button>
          </div>

          {/* Request Section */}
          <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h2>Submit Reimbursement Request (Organizer)</h2>
            <input
              type="number"
              step="0.01"
              placeholder="Amount in ETH"
              value={requestAmount}
              onChange={(e) => setRequestAmount(e.target.value)}
              style={{ padding: '8px', marginRight: '10px', width: '150px' }}
            />
            <input
              type="text"
              placeholder="IPFS CID (e.g., Qm...)"
              value={evidenceCID}
              onChange={(e) => setEvidenceCID(e.target.value)}
              style={{ padding: '8px', marginRight: '10px', width: '300px' }}
            />
            <button onClick={handleSubmitRequest} disabled={loading} style={{ padding: '8px 16px' }}>
              Submit Request
            </button>
          </div>

          {/* Validator Section */}
          <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h2>Validator Actions</h2>
            <select
              value={selectedRequestId}
              onChange={(e) => setSelectedRequestId(e.target.value)}
              style={{ padding: '8px', marginRight: '10px', width: '100px' }}
            >
              <option value="">Select ID</option>
              {requests.map((req) => (
                <option key={req.id} value={req.id}>{req.id}</option>
              ))}
            </select>
            <button onClick={() => handleVote(true)} disabled={loading || !selectedRequestId} style={{ padding: '8px 16px', marginRight: '10px' }}>
              Approve
            </button>
            <button onClick={() => handleVote(false)} disabled={loading || !selectedRequestId} style={{ padding: '8px 16px' }}>
              Reject
            </button>
          </div>

          {/* Requests List */}
          <div style={{ margin: '20px 0', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
            <h2>Recent Requests</h2>
            {requests.length === 0 ? (
              <p>No requests yet.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Organizer</th>
                    <th>Amount</th>
                    <th>Evidence</th>
                    <th>Approvals</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((req) => (
                    <tr key={req.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td>{req.id}</td>
                      <td>{req.organizer.slice(0, 6)}...{req.organizer.slice(-4)}</td>
                      <td>{req.amount} ETH</td>
                      <td>
                        <a href={`https://ipfs.io/ipfs/${req.evidenceCID}`} target="_blank" rel="noopener noreferrer">
                          View
                        </a>
                      </td>
                      <td>{req.approvals}/3</td>
                      <td>{req.paid ? 'Paid' : req.approved ? 'Approved' : 'Pending'}</td>
                      <td>
                        {req.approved && !req.paid && (
                          <button onClick={() => handleClaim(req.id)} disabled={loading}>Claim</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

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