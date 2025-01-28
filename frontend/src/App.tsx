import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { SwapList } from './components/SwapList';
import { CreateSwap } from './components/CreateSwap';

require('@solana/wallet-adapter-react-ui/styles.css');

const App: React.FC = () => {
    const endpoint = useMemo(() => clusterApiUrl('devnet'), []);
    const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    <div className="app-container">
                        <CreateSwap />
                        <SwapList />
                    </div>
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

export default App;

//Program Id: w3Z41mVWnu3k9HQZGBMMphBm4hgKZCsoTnFMr6shezk

//solana logs -u devnet <your-program-id>
//cargo test-bpf

// Wrote new keypair to /Users/maki/.config/solana/id.json
// ==================================================================================
// pubkey: 51mnm4D2Cc8o6X8ybgy4hyLaD962h2uuiJ8jTy13TxSc
// ==================================================================================
// Save this seed phrase and your BIP39 passphrase to recover your new keypair:
// satisfy capital toast maximum coast proof dynamic crouch wink minor traffic before
// ==================================================================================
