import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { WalletContextState } from '@solana/wallet-adapter-react';

export interface SwapPair {
    id: string;
    tokenAMint: PublicKey;
    tokenBMint: PublicKey;
    amountA: number;
    priceB: number;
    creatorPubkey: PublicKey;
    isActive: boolean;
    tokenAAccount: PublicKey;
}

export class SwapClient {
    constructor(
        private connection: Connection,
        private programId: PublicKey,
        private walletContext: WalletContextState
    ) {}

    async createSwapPair(
        tokenAMint: PublicKey,
        tokenBMint: PublicKey,
        amountA: number,
        priceB: number
    ): Promise<string> {
        if (!this.walletContext.publicKey) throw new Error('Wallet not connected');
        
        const tokenAAccount = await getAssociatedTokenAddress(tokenAMint, this.walletContext.publicKey);
        
        const data = Buffer.from([
            1,
            ...tokenAMint.toBytes(),
            ...tokenBMint.toBytes(),
            ...new Uint8Array(new BigInt64Array([BigInt(amountA)]).buffer),
            ...new Uint8Array(new BigInt64Array([BigInt(priceB)]).buffer),
        ]);

        const instruction = new TransactionInstruction({
            programId: this.programId,
            keys: [
                { pubkey: this.walletContext.publicKey, isSigner: true, isWritable: true },
                { pubkey: tokenAAccount, isSigner: false, isWritable: true },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data,
        });

        const transaction = new Transaction().add(instruction);
        
        const signature = await this.walletContext.sendTransaction(transaction, this.connection);
        
        // Wait for confirmation with increased timeout and commitment
        await this.connection.confirmTransaction({
            signature,
            blockhash: transaction.recentBlockhash!,
            lastValidBlockHeight: transaction.lastValidBlockHeight!
        }, 'confirmed');
        
        return signature;
    }
    async executeSwap(swapPairId: PublicKey): Promise<string> {
        if (!this.walletContext.publicKey) throw new Error('Wallet not connected');

        const instruction = new TransactionInstruction({
            programId: this.programId,
            keys: [
                { pubkey: this.walletContext.publicKey, isSigner: true, isWritable: true },
                { pubkey: swapPairId, isSigner: false, isWritable: true },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            data: Buffer.from([2]),
        });

        const transaction = new Transaction().add(instruction);
        const signature = await this.walletContext.sendTransaction(transaction, this.connection);
        await this.connection.confirmTransaction(signature);
        return signature;
    }

    async listSwapPairs(): Promise<SwapPair[]> {
        const accounts = await this.connection.getProgramAccounts(this.programId);
        return accounts.map(({ pubkey, account }) => this.deserializeSwapPair(pubkey, account.data));
    }

    private deserializeSwapPair(pubkey: PublicKey, data: Buffer): SwapPair {
        const tokenAMint = new PublicKey(data.slice(1, 33));
        const tokenBMint = new PublicKey(data.slice(33, 65));
        const tokenAAccount = new PublicKey(data.slice(65, 97));
        const amountA = Number(data.readBigUInt64LE(97));
        const priceB = Number(data.readBigUInt64LE(105));
        const creatorPubkey = new PublicKey(data.slice(113, 145));
        const isActive = data[data.length - 1] === 1;

        return {
            id: pubkey.toString(),
            tokenAMint,
            tokenBMint,
            tokenAAccount,
            amountA,
            priceB,
            creatorPubkey,
            isActive,
        };
    }
}
