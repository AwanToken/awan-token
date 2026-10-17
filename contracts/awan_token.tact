// =============================================================================
// $AWN — AwanToken (The Open Network / Tact)
// =============================================================================
// Jetton TEP-74/TEP-89 con:
//  - switch di lancio, blacklist, limiti buy/sell DEX
//  - limiti DEX: % pool + % possesso wallet + tetto assoluto $AWN/tx (maxSellAbsolute)
//  - tassa vendita 3% in jetton → conversione keeper → tesoreria TON/GRAM
//  - batch airdrop (max 150 dest., tetto default 150_000 $AWN)
//  - claim settimanale ponderato + finestra 24h + penalità anti-sniper 50%
//
// Supply fissa: 1_000_000_000 $AWN (9 decimali), tutta all'Owner in init.
// Pool DEX (~25%): l'owner la rifornisce manualmente dopo il deploy.
// Fase 1: trading on + sells off → solo acquisti.
// Claim: parte quando is_sell_enabled = true (tesoreria si riempie dalle sell tax).
// =============================================================================

const TOTAL_SUPPLY: Int = 1000000000000000000; // 1e9 tokens * 1e9 (9 decimals)
const BP_DENOMINATOR: Int = 10000;
/// Max buy per tx = this bp of current pool $AWN balance (not total supply).
const DEFAULT_MAX_BUY_BP: Int = 50;           // 0.5% of pool
/// Max sell into pool per tx = this bp of current pool $AWN balance.
const DEFAULT_MAX_SELL_BP: Int = 50;          // 0.5% of pool
/// Max sell per tx = this bp of the seller's own wallet balance (anti full-bag dump).
const DEFAULT_POSSESSION_LIMIT_BP: Int = 50;  // 0.5% of possession
/// Hard ceiling in raw units (9 decimals). 0 = disabled (bp limits only).
const DEFAULT_MAX_SELL_ABSOLUTE: Int = 0;
const DEFAULT_SELL_TAX_BP: Int = 300;         // 3%
const CLAIM_PERIOD_SECONDS: Int = 604800;     // 7 days
const CLAIM_WINDOW_SECONDS: Int = 86400;      // 24 hours claim window
const MAX_BATCH_RECIPIENTS: Int = 150;
const DEFAULT_MAX_BATCH_AMOUNT: Int = 150000000000000; // 150_000 * 1e9
const ANTI_SNIPER_PENALTY_BP: Int = 5000;     // 50% payout
const MIN_TONS_STORAGE: Int = ton("0.05");

// -----------------------------------------------------------------------------
// Shared structs
// -----------------------------------------------------------------------------

struct HolderInfo {
    balance: Int as coins;
    lastUpdate: Int as uint32;
    /// Lowest balance during the current claim cycle (anti-freeloader).
    minBalancePeriod: Int as coins;
    /// Balance snapshotted at cycle touch / start (full reward if never dipped).
    periodStartBalance: Int as coins;
    /// Cycle id already claimed by this holder (0 = never).
    claimedCycleId: Int as uint32;
}

struct AwanConfig {
    isTradingEnabled: Bool;
    isSellEnabled: Bool;
    isDexLimitsEnabled: Bool;
    dexPool: Address?;
    maxBuyLimitBp: Int as uint16;
    maxSellLimitBp: Int as uint16;
    /// Max fraction of seller balance sellable in one tx (bp of possession).
    possessionLimitBp: Int as uint16;
    sellTaxBp: Int as uint16;
    totalSupply: Int as coins;
    /// Last-known pool jetton balance (updated via ReportBalance from pool holder).
    poolJettonBalance: Int as coins;
    maxBatchTransferAmount: Int as coins;
    /// Token admin (minter owner) — may move tokens before public trading.
    admin: Address;
    /// Max $AWN sold into pool per tx (raw 9-dec). 0 = no absolute ceiling.
    maxSellAbsolute: Int as coins;
}

struct JettonData {
    totalSupply: Int as coins;
    mintable: Bool;
    owner: Address;
    content: Cell;
    jettonWalletCode: Cell;
}

struct JettonWalletData {
    balance: Int as coins;
    owner: Address;
    minter: Address;
    code: Cell;
}

struct ClaimStatus {
    cycleId: Int as uint32;
    cycleStart: Int as uint32;
    claimWindowOpen: Bool;
    claimWindowEnd: Int as uint32;
    treasuryBalance: Int as coins;
    claimPoolSnapshot: Int as coins;
    sellsEnabled: Bool;
    claimProgramActive: Bool;
}

// -----------------------------------------------------------------------------
// TEP-74 / TEP-89
// -----------------------------------------------------------------------------

message(0xf8a7ea5) JettonTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x178d4519) JettonTransferInternal {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    responseDestination: Address?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

message(0x7362d09c) JettonNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forwardPayload: Slice as remaining;
}

message(0x595f07bc) JettonBurn {
    queryId: Int as uint64;
    amount: Int as coins;
    responseDestination: Address?;
    customPayload: Cell?;
}

message(0x7bdd97de) JettonBurnNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    responseDestination: Address?;
}

message(0xd53276db) JettonExcesses {
    queryId: Int as uint64;
}

message(0x2c76b973) ProvideWalletAddress {
    queryId: Int as uint64;
    ownerAddress: Address;
    includeAddress: Bool;
}

message(0xd1735400) TakeWalletAddress {
    queryId: Int as uint64;
    walletAddress: Address;
    ownerAddress: Cell?;
}

// -----------------------------------------------------------------------------
// Admin / product messages
// -----------------------------------------------------------------------------

message EnableTrading { queryId: Int as uint64; }

message SetSellEnabled {
    queryId: Int as uint64;
    enabled: Bool;
}

message SetDexLimitsEnabled {
    queryId: Int as uint64;
    enabled: Bool;
}

message SetDexPool {
    queryId: Int as uint64;
    pool: Address?;
}

message SetBuyLimitBp {
    queryId: Int as uint64;
    maxBuyLimitBp: Int as uint16;
}

message SetSellLimitBp {
    queryId: Int as uint64;
    maxSellLimitBp: Int as uint16;
}

message SetMaxSellAbsolute {
    queryId: Int as uint64;
    /// Raw jetton units (9 decimals). 0 disables the absolute ceiling.
    maxSellAbsolute: Int as coins;
}

message SetPossessionLimitBp {
    queryId: Int as uint64;
    possessionLimitBp: Int as uint16;
}

message SetSellTaxBp {
    queryId: Int as uint64;
    sellTaxBp: Int as uint16;
}

message SetBlacklist {
    queryId: Int as uint64;
    account: Address;
    blocked: Bool;
}

message SetMaxBatchTransferAmount {
    queryId: Int as uint64;
    amount: Int as coins;
}

message ChangeOwner {
    queryId: Int as uint64;
    newOwner: Address;
}

message UpdateContent {
    queryId: Int as uint64;
    content: Cell;
}

message PushWalletConfig {
    queryId: Int as uint64;
    walletOwner: Address;
}

message SyncWalletConfig {
    queryId: Int as uint64;
    config: AwanConfig;
}

message SetWalletBlocked {
    queryId: Int as uint64;
    blocked: Bool;
}

/// Airdrop from the caller's jetton wallet (usually owner).
/// Payload: uint8 n (1..150) + n × (Address + coins).
message BatchTransfer {
    queryId: Int as uint64;
    payload: Cell;
}

message ClaimReward { queryId: Int as uint64; }

message DepositTreasury { queryId: Int as uint64; }

/// Owner-only: open the claim window immediately (testnet / ops).
/// Sets snapshot = current treasury and aligns cycleStart so the 24h window starts now.
message ForceOpenClaimWindow { queryId: Int as uint64; }

/// Owner-only: close claim window early (unclaimed TON stays in treasury).
message ForceCloseClaimWindow { queryId: Int as uint64; }

/// Owner-only: set accrual period to 1 / 3 / 5 / 7 days (86400 * days).
message SetClaimPeriodDays {
    queryId: Int as uint64;
    days: Int as uint8;
}

/// Owner-only: arm / disarm the claim program (independent of sells).
message SetClaimProgramActive {
    queryId: Int as uint64;
    enabled: Bool;
}

/// Owner sweeps sell-tax $AWN from the minter jetton wallet → Keeper (or any dest).
/// amount = 0 means sweep all pendingTaxJettons.
message SweepTaxJettons {
    queryId: Int as uint64;
    destination: Address;
    amount: Int as coins;
}

message ReportBalance {
    queryId: Int as uint64;
    holder: Address;
    newBalance: Int as coins;
}

message ReportTaxJettons {
    queryId: Int as uint64;
    amount: Int as coins;
    seller: Address;
}

message MintInitial {
    queryId: Int as uint64;
}

// =============================================================================
// AwanWallet
// Address = f(code, owner, minter) — balance/config MUST NOT affect address.
// =============================================================================

contract AwanWallet {
    owner: Address;
    minter: Address;
    balance: Int as coins;
    config: AwanConfig;
    blocked: Bool;
    minted: Bool;

    init(owner: Address, minter: Address) {
        self.owner = owner;
        self.minter = minter;
        self.balance = 0;
        self.blocked = false;
        self.minted = false;
        // Safe defaults until SyncWalletConfig arrives from minter
        self.config = AwanConfig{
            isTradingEnabled: false,
            isSellEnabled: false,
            isDexLimitsEnabled: true,
            dexPool: null,
            maxBuyLimitBp: DEFAULT_MAX_BUY_BP,
            maxSellLimitBp: DEFAULT_MAX_SELL_BP,
            possessionLimitBp: DEFAULT_POSSESSION_LIMIT_BP,
            sellTaxBp: DEFAULT_SELL_TAX_BP,
            totalSupply: TOTAL_SUPPLY,
            poolJettonBalance: 0,
            maxBatchTransferAmount: DEFAULT_MAX_BATCH_AMOUNT,
            admin: minter, // overwritten by SyncWalletConfig with real admin
            maxSellAbsolute: DEFAULT_MAX_SELL_ABSOLUTE,
        };
    }

    receive(msg: SyncWalletConfig) {
        require(sender() == self.minter, "Only minter");
        self.config = msg.config;
    }

    receive(msg: SetWalletBlocked) {
        require(sender() == self.minter, "Only minter");
        self.blocked = msg.blocked;
    }

    /// One-shot credit used only by minter at genesis (owner supply).
    receive(msg: MintInitial) {
        require(sender() == self.minter, "Only minter");
        require(!self.minted, "Already minted");
        self.minted = true;
        self.balance = TOTAL_SUPPLY;
    }

    receive(msg: JettonTransfer) {
        require(sender() == self.owner, "Only owner");
        require(!self.blocked, "Sender blacklisted");
        require(msg.amount > 0, "Zero amount");
        require(msg.amount <= self.balance, "Insufficient balance");

        let isToPool: Bool = false;
        if (self.config.dexPool != null) {
            if (msg.destination == self.config.dexPool!!) {
                isToPool = true;
            }
        }

        // Tax collector = jetton wallet owned by the minter; always allowed to send out
        // (owner calls SweepTaxJettons on the minter → JettonTransfer from this wallet).
        let isTaxCollector: Bool = self.owner == self.minter;

        // Until launch: block transfers toward the DEX pool (no sells / no pool dumps)
        if (!self.config.isTradingEnabled && !isTaxCollector) {
            require(!isToPool, "Trading disabled: pool transfer blocked");
            // Non-admin wallets cannot freely circulate before launch
            require(self.owner == self.config.admin, "Trading disabled");
        }

        if (isToPool) {
            require(self.config.isSellEnabled, "Sells disabled");
        }

        // Pool wallet outbound = user buy path: cap vs pool's own balance (accurate).
        let isPoolWallet: Bool = false;
        if (self.config.dexPool != null) {
            if (self.owner == self.config.dexPool!!) {
                isPoolWallet = true;
            }
        }
        if (isPoolWallet && self.config.isDexLimitsEnabled) {
            require(self.balance > 0, "Empty pool");
            let maxBuy: Int = (self.balance * self.config.maxBuyLimitBp) / BP_DENOMINATOR;
            require(msg.amount <= maxBuy, "Buy limit exceeded");
        }

        let transferAmount: Int = msg.amount;
        let taxAmount: Int = 0;

        // Sell into pool: pool % + possession % + optional absolute $AWN ceiling.
        // Effective max = min(pool%, possession%, absolute if > 0). Per tx.
        // Pool wallet also re-checks pool % on receive with live self.balance.
        // (Top up liquidity before SetDexPool, or briefly SetDexLimitsEnabled(false).)
        if (isToPool && self.config.isDexLimitsEnabled) {
            let maxPoolSell: Int = (self.config.poolJettonBalance * self.config.maxSellLimitBp) / BP_DENOMINATOR;
            require(msg.amount <= maxPoolSell, "Sell limit exceeded");
            let maxPoss: Int = (self.balance * self.config.possessionLimitBp) / BP_DENOMINATOR;
            require(msg.amount <= maxPoss, "Possession sell limit exceeded");
            if (self.config.maxSellAbsolute > 0) {
                require(msg.amount <= self.config.maxSellAbsolute, "Absolute sell limit exceeded");
            }
        }

        // Sell tax in $AWN → minter jetton wallet; keeper swaps to TON → DepositTreasury
        if (isToPool && self.config.sellTaxBp > 0) {
            taxAmount = (msg.amount * self.config.sellTaxBp) / BP_DENOMINATOR;
            transferAmount = msg.amount - taxAmount;
            require(transferAmount > 0, "Amount too small after tax");
        }

        self.balance -= msg.amount;

        self.reportBalance(msg.queryId);

        if (taxAmount > 0) {
            // Tax collector = jetton wallet owned by the minter contract itself
            deploy(DeployParameters{
                init: initOf AwanWallet(self.minter, self.minter),
                value: ton("0.05"),
                mode: SendPayGasSeparately,
                bounce: true,
                body: JettonTransferInternal{
                    queryId: msg.queryId,
                    amount: taxAmount,
                    sender: self.owner,
                    responseDestination: msg.responseDestination,
                    forwardTonAmount: 0,
                    forwardPayload: emptySlice(),
                }.toCell(),
            });

            send(SendParameters{
                to: self.minter,
                value: ton("0.01"),
                mode: SendPayGasSeparately,
                bounce: true,
                body: ReportTaxJettons{
                    queryId: msg.queryId,
                    amount: taxAmount,
                    seller: self.owner,
                }.toCell(),
            });
        }

        deploy(DeployParameters{
            init: initOf AwanWallet(msg.destination, self.minter),
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: JettonTransferInternal{
                queryId: msg.queryId,
                amount: transferAmount,
                sender: self.owner,
                responseDestination: msg.responseDestination,
                forwardTonAmount: msg.forwardTonAmount,
                forwardPayload: msg.forwardPayload,
            }.toCell(),
        });
    }

    receive(msg: JettonTransferInternal) {
        let fromMinter: Bool = sender() == self.minter;
        let peer: Address = contractAddress(initOf AwanWallet(msg.sender, self.minter));
        require(fromMinter || sender() == peer, "Unauthorized transfer");
        require(!self.blocked, "Recipient blacklisted");

        // Tokens arriving from the DEX pool = user buy (trading gate).
        // Buy size vs pool is enforced on the pool wallet's outbound JettonTransfer.
        if (self.config.dexPool != null && msg.sender == self.config.dexPool!!) {
            require(self.config.isTradingEnabled, "Trading disabled");
        }

        // This wallet IS the pool: incoming transfer = user sell → cap vs pool balance.
        let isPoolWallet: Bool = false;
        if (self.config.dexPool != null) {
            if (self.owner == self.config.dexPool!!) {
                isPoolWallet = true;
            }
        }
        if (isPoolWallet && self.config.isDexLimitsEnabled) {
            require(self.balance > 0, "Empty pool");
            // Incoming amount is post-tax; still bounds AWN entering the pool.
            let maxSell: Int = (self.balance * self.config.maxSellLimitBp) / BP_DENOMINATOR;
            require(msg.amount <= maxSell, "Sell limit exceeded");
            // Absolute ceiling also enforced here so PushWalletConfig(vault) is enough
            // even if the seller JW still has a stale config (0 = disabled).
            if (self.config.maxSellAbsolute > 0) {
                require(msg.amount <= self.config.maxSellAbsolute, "Absolute sell limit exceeded");
            }
        }

        self.balance += msg.amount;
        self.reportBalance(msg.queryId);

        if (msg.forwardTonAmount > 0) {
            send(SendParameters{
                to: self.owner,
                value: msg.forwardTonAmount,
                mode: SendPayGasSeparately,
                bounce: false,
                body: JettonNotification{
                    queryId: msg.queryId,
                    amount: msg.amount,
                    sender: msg.sender,
                    forwardPayload: msg.forwardPayload,
                }.toCell(),
            });
        }

        if (msg.responseDestination != null) {
            send(SendParameters{
                to: msg.responseDestination!!,
                value: 0,
                mode: SendRemainingValue | SendIgnoreErrors,
                bounce: false,
                body: JettonExcesses{ queryId: msg.queryId }.toCell(),
            });
        }
    }

    receive(msg: JettonBurn) {
        require(sender() == self.owner, "Only owner");
        require(msg.amount <= self.balance, "Insufficient balance");
        self.balance -= msg.amount;
        self.reportBalance(msg.queryId);

        send(SendParameters{
            to: self.minter,
            value: 0,
            mode: SendRemainingValue,
            bounce: true,
            body: JettonBurnNotification{
                queryId: msg.queryId,
                amount: msg.amount,
                sender: self.owner,
                responseDestination: msg.responseDestination,
            }.toCell(),
        });
    }

    /// Security batch airdrop — executed from the holder wallet (typically admin).
    receive(msg: BatchTransfer) {
        require(sender() == self.owner, "Only owner");
        require(!self.blocked, "Blacklisted");
        // Only admin wallet may batch (anti-abuse)
        require(self.owner == self.config.admin, "Only admin wallet");

        let s: Slice = msg.payload.beginParse();
        let count: Int = s.loadUint(8);
        require(count > 0 && count <= MAX_BATCH_RECIPIENTS, "Batch size 1..150");

        let total: Int = 0;
        let i: Int = 0;

        // First pass: validate & sum
        let sCheck: Slice = msg.payload.beginParse();
        let nCheck: Int = sCheck.loadUint(8);
        require(nCheck == count, "Corrupt batch payload");
        while (i < nCheck) {
            sCheck.loadAddress();
            let amount: Int = sCheck.loadCoins();
            require(amount > 0, "Zero amount");
            total += amount;
            i += 1;
        }
        require(total <= self.config.maxBatchTransferAmount, "Batch amount cap");
        require(total <= self.balance, "Insufficient balance");

        self.balance -= total;
        self.reportBalance(msg.queryId);

        i = 0;
        while (i < count) {
            let to: Address = s.loadAddress();
            let amount: Int = s.loadCoins();

            deploy(DeployParameters{
                init: initOf AwanWallet(to, self.minter),
                value: ton("0.06"),
                mode: SendPayGasSeparately,
                bounce: true,
                body: JettonTransferInternal{
                    queryId: msg.queryId,
                    amount: amount,
                    sender: self.owner,
                    responseDestination: self.owner,
                    forwardTonAmount: 0,
                    forwardPayload: emptySlice(),
                }.toCell(),
            });
            i += 1;
        }
    }

    fun reportBalance(queryId: Int) {
        send(SendParameters{
            to: self.minter,
            value: ton("0.015"),
            mode: SendPayGasSeparately,
            bounce: true,
            body: ReportBalance{
                queryId: queryId,
                holder: self.owner,
                newBalance: self.balance,
            }.toCell(),
        });
    }

    bounced(msg: bounced<JettonTransferInternal>) {
        self.balance += msg.amount;
    }

    bounced(msg: bounced<JettonBurnNotification>) {
        self.balance += msg.amount;
    }

    get fun get_wallet_data(): JettonWalletData {
        return JettonWalletData{
            balance: self.balance,
            owner: self.owner,
            minter: self.minter,
            code: myCode(),
        };
    }

    get fun get_config(): AwanConfig {
        return self.config;
    }

    get fun is_blocked(): Bool {
        return self.blocked;
    }
}

// =============================================================================
// AwanToken (Jetton Master / Minter)
// =============================================================================

contract AwanToken {
    owner: Address;
    totalSupply: Int as coins;
    mintable: Bool;
    content: Cell;

    isTradingEnabled: Bool;
    isSellEnabled: Bool;
    isDexLimitsEnabled: Bool;
    dexPool: Address?;

    maxBuyLimitBp: Int as uint16;
    maxSellLimitBp: Int as uint16;
    possessionLimitBp: Int as uint16;
    sellTaxBp: Int as uint16;
    maxBatchTransferAmount: Int as coins;
    /// Max $AWN per sell tx (raw 9-dec). 0 = disabled.
    maxSellAbsolute: Int as coins;
    /// Cached pool $AWN balance from ReportBalance (for config sync / getters).
    poolJettonBalance: Int as coins;

    blacklist: map<Address, Bool>;

    /// Native TON/GRAM for weekly claims (post tax conversion).
    treasuryGramBalance: Int as coins;
    /// $AWN sell-tax awaiting keeper swap → TON.
    pendingTaxJettons: Int as coins;

    currentCycleStart: Int as uint32;
    currentCycleId: Int as uint32;
    claimPoolSnapshot: Int as coins;
    claimWindowOpened: Bool;
    claimProgramActive: Bool;
    /// Accrual length (default 7d). Owner may set 1/3/5/7 days via SetClaimPeriodDays.
    claimPeriodSeconds: Int as uint32;

    holders: map<Address, HolderInfo>;
    genesisDone: Bool;

    init(owner: Address, content: Cell) {
        self.owner = owner;
        self.totalSupply = TOTAL_SUPPLY;
        self.mintable = false;
        self.content = content;

        self.isTradingEnabled = false;
        self.isSellEnabled = false;
        self.isDexLimitsEnabled = true;
        self.dexPool = null;

        self.maxBuyLimitBp = DEFAULT_MAX_BUY_BP;
        self.maxSellLimitBp = DEFAULT_MAX_SELL_BP;
        self.possessionLimitBp = DEFAULT_POSSESSION_LIMIT_BP;
        self.sellTaxBp = DEFAULT_SELL_TAX_BP;
        self.maxBatchTransferAmount = DEFAULT_MAX_BATCH_AMOUNT;
        self.maxSellAbsolute = DEFAULT_MAX_SELL_ABSOLUTE;
        self.poolJettonBalance = 0;

        self.treasuryGramBalance = 0;
        self.pendingTaxJettons = 0;

        self.currentCycleStart = 0;
        self.currentCycleId = 0;
        self.claimPoolSnapshot = 0;
        self.claimWindowOpened = false;
        self.claimProgramActive = false;
        self.claimPeriodSeconds = CLAIM_PERIOD_SECONDS;
        self.genesisDone = false;

        self.holders.set(owner, HolderInfo{
            balance: TOTAL_SUPPLY,
            lastUpdate: now(),
            minBalancePeriod: TOTAL_SUPPLY,
            periodStartBalance: TOTAL_SUPPLY,
            claimedCycleId: 0,
        });
    }

    /// Call once after deploy (attach ~0.25 TON): mints full supply into owner wallet + syncs config.
    receive(msg: MintInitial) {
        self.onlyOwner();
        require(!self.genesisDone, "Genesis done");
        self.genesisDone = true;

        let cfg: AwanConfig = self.buildConfig();
        let walletInit: StateInit = initOf AwanWallet(self.owner, myAddress());

        deploy(DeployParameters{
            init: walletInit,
            value: ton("0.15"),
            mode: SendPayGasSeparately,
            bounce: true,
            body: MintInitial{ queryId: msg.queryId }.toCell(),
        });

        send(SendParameters{
            to: contractAddress(walletInit),
            value: ton("0.05"),
            mode: SendPayGasSeparately,
            bounce: true,
            body: SyncWalletConfig{
                queryId: msg.queryId,
                config: cfg,
            }.toCell(),
        });
    }

    // ----- helpers -----

    fun buildConfig(): AwanConfig {
        return AwanConfig{
            isTradingEnabled: self.isTradingEnabled,
            isSellEnabled: self.isSellEnabled,
            isDexLimitsEnabled: self.isDexLimitsEnabled,
            dexPool: self.dexPool,
            maxBuyLimitBp: self.maxBuyLimitBp,
            maxSellLimitBp: self.maxSellLimitBp,
            possessionLimitBp: self.possessionLimitBp,
            sellTaxBp: self.sellTaxBp,
            totalSupply: self.totalSupply,
            poolJettonBalance: self.poolJettonBalance,
            maxBatchTransferAmount: self.maxBatchTransferAmount,
            admin: self.owner,
            maxSellAbsolute: self.maxSellAbsolute,
        };
    }

    fun onlyOwner() {
        require(sender() == self.owner, "Only owner");
    }

    fun isBlacklisted(account: Address): Bool {
        let flag: Bool? = self.blacklist.get(account);
        return flag != null && flag!!;
    }

    fun walletAddress(ownerAddress: Address): Address {
        return contractAddress(initOf AwanWallet(ownerAddress, myAddress()));
    }

    fun refreshHolderForNewCycle(info: HolderInfo): HolderInfo {
        return HolderInfo{
            balance: info.balance,
            lastUpdate: now(),
            minBalancePeriod: info.balance,
            periodStartBalance: info.balance,
            claimedCycleId: info.claimedCycleId,
        };
    }

    fun maybeOpenClaimWindow() {
        if (!self.claimProgramActive || self.currentCycleStart == 0) {
            return;
        }
        let elapsed: Int = now() - self.currentCycleStart;
        let period: Int = self.claimPeriodSeconds;
        // Open window only once treasury has funds (avoid freezing snapshot=0 on early ReportBalance).
        if (!self.claimWindowOpened && elapsed >= period) {
            if (self.treasuryGramBalance > 0) {
                self.claimPoolSnapshot = self.treasuryGramBalance;
                self.claimWindowOpened = true;
            }
        } else if (self.claimWindowOpened && self.claimPoolSnapshot == 0 && self.treasuryGramBalance > 0) {
            // Recover from a previous empty snapshot (testnet / early open).
            self.claimPoolSnapshot = self.treasuryGramBalance;
        }
        if (self.claimWindowOpened && elapsed >= (period + CLAIM_WINDOW_SECONDS)) {
            // Unclaimed GRAM stays in treasury for future cycles
            self.currentCycleStart = now();
            self.currentCycleId += 1;
            self.claimWindowOpened = false;
            self.claimPoolSnapshot = 0;
        }
    }

    /// Claim is Owner-armed only via SetClaimProgramActive (not auto on sells).
    /// Sells can be ON while claim stays OFF at launch.

    // ----- native treasury intake (keeper / DEX conversion) -----
    // Empty receive accepts leftover TON/GRAM from DEX swap callbacks.
    // Prefer DepositTreasury from the keeper for explicit accounting.

    receive() {
        let ctx: Context = context();
        // Ignore dust that cannot cover storage; credit the rest to treasury.
        if (ctx.value > ton("0.001")) {
            self.treasuryGramBalance += ctx.value;
        }
    }

    receive(msg: DepositTreasury) {
        let ctx: Context = context();
        require(ctx.value > 0, "No TON attached");
        self.treasuryGramBalance += ctx.value;
        self.maybeOpenClaimWindow();
    }

    receive(msg: ForceOpenClaimWindow) {
        self.onlyOwner();
        require(self.claimProgramActive, "Claim not active");
        require(self.treasuryGramBalance > 0, "Empty treasury");
        // Pretend accrual just ended → 24h window opens now.
        self.currentCycleStart = now() - self.claimPeriodSeconds;
        self.claimPoolSnapshot = self.treasuryGramBalance;
        self.claimWindowOpened = true;
    }

    receive(msg: ForceCloseClaimWindow) {
        self.onlyOwner();
        require(self.claimProgramActive, "Claim not active");
        // Close window; unclaimed TON stays in treasury for the next cycle.
        self.claimWindowOpened = false;
        self.claimPoolSnapshot = 0;
        self.currentCycleStart = now();
        self.currentCycleId += 1;
    }

    receive(msg: SetClaimPeriodDays) {
        self.onlyOwner();
        let d: Int = msg.days;
        require(d == 1 || d == 3 || d == 5 || d == 7, "Days must be 1/3/5/7");
        self.claimPeriodSeconds = d * 86400;
        // Restart accrual from now with the new period (window closed).
        if (self.claimProgramActive) {
            self.claimWindowOpened = false;
            self.claimPoolSnapshot = 0;
            self.currentCycleStart = now();
            if (self.currentCycleId == 0) {
                self.currentCycleId = 1;
            }
        }
    }

    receive(msg: SetClaimProgramActive) {
        self.onlyOwner();
        if (msg.enabled) {
            self.claimProgramActive = true;
            if (self.currentCycleStart == 0) {
                self.currentCycleStart = now();
            }
            if (self.currentCycleId == 0) {
                self.currentCycleId = 1;
            }
            // Do not auto-open window — Owner uses ForceOpen or waits accrual.
            self.claimWindowOpened = false;
            self.claimPoolSnapshot = 0;
        } else {
            self.claimProgramActive = false;
            self.claimWindowOpened = false;
            self.claimPoolSnapshot = 0;
        }
    }

    // ----- TEP-89 -----

    receive(msg: ProvideWalletAddress) {
        send(SendParameters{
            to: sender(),
            value: 0,
            mode: SendRemainingValue,
            body: TakeWalletAddress{
                queryId: msg.queryId,
                walletAddress: self.walletAddress(msg.ownerAddress),
                ownerAddress: null,
            }.toCell(),
        });
    }

    // ----- burn -----

    receive(msg: JettonBurnNotification) {
        require(sender() == self.walletAddress(msg.sender), "Unauthorized burn");
        require(msg.amount <= self.totalSupply, "Supply underflow");
        self.totalSupply -= msg.amount;

        if (msg.responseDestination != null) {
            send(SendParameters{
                to: msg.responseDestination!!,
                value: 0,
                bounce: false,
                mode: SendRemainingValue | SendIgnoreErrors,
                body: JettonExcesses{ queryId: msg.queryId }.toCell(),
            });
        }
    }

    // ----- wallet reports -----

    receive(msg: ReportBalance) {
        require(sender() == self.walletAddress(msg.holder), "Unauthorized report");

        // Do not open claim window here — sell reports can freeze snapshot=0 before treasury fill.
        // Window opens on DepositTreasury / ClaimReward via maybeOpenClaimWindow().

        // Keep pool liquidity cache fresh for getters / PushWalletConfig sync.
        if (self.dexPool != null && msg.holder == self.dexPool!!) {
            self.poolJettonBalance = msg.newBalance;
        }

        let existing: HolderInfo? = self.holders.get(msg.holder);
        if (existing == null) {
            self.holders.set(msg.holder, HolderInfo{
                balance: msg.newBalance,
                lastUpdate: now(),
                minBalancePeriod: msg.newBalance,
                periodStartBalance: msg.newBalance,
                claimedCycleId: 0,
            });
            return;
        }

        let info: HolderInfo = existing!!;
        if (self.claimProgramActive && info.lastUpdate < self.currentCycleStart) {
            info = self.refreshHolderForNewCycle(info);
        }

        let minBal: Int = info.minBalancePeriod;
        if (msg.newBalance < minBal) {
            minBal = msg.newBalance;
        }

        self.holders.set(msg.holder, HolderInfo{
            balance: msg.newBalance,
            lastUpdate: now(),
            minBalancePeriod: minBal,
            periodStartBalance: info.periodStartBalance,
            claimedCycleId: info.claimedCycleId,
        });
    }

    receive(msg: ReportTaxJettons) {
        require(sender() == self.walletAddress(msg.seller), "Unauthorized tax report");
        self.pendingTaxJettons += msg.amount;
    }

    /// Move pending sell-tax $AWN from AwanWallet(minter, minter) → Keeper (manual DEX swap).
    /// Attach ~0.15 TON. amount=0 sweeps all pendingTaxJettons.
    receive(msg: SweepTaxJettons) {
        self.onlyOwner();
        let amount: Int = msg.amount;
        if (amount == 0) {
            amount = self.pendingTaxJettons;
        }
        require(amount > 0, "Nothing to sweep");
        require(amount <= self.pendingTaxJettons, "Exceeds pending tax");

        self.pendingTaxJettons -= amount;

        // Minter owns the tax jetton wallet → send JettonTransfer as owner
        send(SendParameters{
            to: self.walletAddress(myAddress()),
            value: ton("0.12"),
            mode: SendPayGasSeparately,
            bounce: true,
            body: JettonTransfer{
                queryId: msg.queryId,
                amount: amount,
                destination: msg.destination,
                responseDestination: self.owner,
                customPayload: null,
                forwardTonAmount: 0,
                forwardPayload: emptySlice(),
            }.toCell(),
        });
    }

    // ----- owner admin -----

    receive(msg: EnableTrading) {
        self.onlyOwner();
        self.isTradingEnabled = true;
    }

    receive(msg: SetSellEnabled) {
        self.onlyOwner();
        self.isSellEnabled = msg.enabled;
        // Claim program is NOT auto-started here — Owner uses SetClaimProgramActive.
    }

    receive(msg: SetDexLimitsEnabled) {
        self.onlyOwner();
        self.isDexLimitsEnabled = msg.enabled;
    }

    receive(msg: SetDexPool) {
        self.onlyOwner();
        self.dexPool = msg.pool;
        // Seed cache from holders (liquidity is often funded before SetDexPool).
        if (msg.pool != null) {
            let info: HolderInfo? = self.holders.get(msg.pool!!);
            if (info != null) {
                self.poolJettonBalance = info!!.balance;
            } else {
                self.poolJettonBalance = 0;
            }
        } else {
            self.poolJettonBalance = 0;
        }
    }

    receive(msg: SetBuyLimitBp) {
        self.onlyOwner();
        require(msg.maxBuyLimitBp > 0 && msg.maxBuyLimitBp <= BP_DENOMINATOR, "Invalid buy bp");
        self.maxBuyLimitBp = msg.maxBuyLimitBp;
    }

    receive(msg: SetSellLimitBp) {
        self.onlyOwner();
        require(msg.maxSellLimitBp > 0 && msg.maxSellLimitBp <= BP_DENOMINATOR, "Invalid sell bp");
        self.maxSellLimitBp = msg.maxSellLimitBp;
    }

    receive(msg: SetMaxSellAbsolute) {
        self.onlyOwner();
        // 0 disables absolute ceiling; otherwise any positive raw amount is allowed.
        require(msg.maxSellAbsolute >= 0, "Invalid absolute sell");
        self.maxSellAbsolute = msg.maxSellAbsolute;
    }

    receive(msg: SetPossessionLimitBp) {
        self.onlyOwner();
        require(msg.possessionLimitBp > 0 && msg.possessionLimitBp <= BP_DENOMINATOR, "Invalid possession bp");
        self.possessionLimitBp = msg.possessionLimitBp;
    }

    receive(msg: SetSellTaxBp) {
        self.onlyOwner();
        require(msg.sellTaxBp <= 1000, "Tax cap 10%");
        self.sellTaxBp = msg.sellTaxBp;
    }

    receive(msg: SetBlacklist) {
        self.onlyOwner();
        self.blacklist.set(msg.account, msg.blocked);
        // Push flag into that account's jetton wallet for on-transfer enforcement
        send(SendParameters{
            to: self.walletAddress(msg.account),
            value: ton("0.05"),
            mode: SendPayGasSeparately,
            bounce: true,
            body: SetWalletBlocked{
                queryId: msg.queryId,
                blocked: msg.blocked,
            }.toCell(),
        });
    }

    receive(msg: SetMaxBatchTransferAmount) {
        self.onlyOwner();
        require(msg.amount > 0, "Invalid amount");
        self.maxBatchTransferAmount = msg.amount;
    }

    receive(msg: ChangeOwner) {
        self.onlyOwner();
        self.owner = msg.newOwner;
    }

    receive(msg: UpdateContent) {
        self.onlyOwner();
        self.content = msg.content;
    }

    receive(msg: PushWalletConfig) {
        self.onlyOwner();
        send(SendParameters{
            to: self.walletAddress(msg.walletOwner),
            value: ton("0.05"),
            mode: SendPayGasSeparately,
            bounce: true,
            body: SyncWalletConfig{
                queryId: msg.queryId,
                config: self.buildConfig(),
            }.toCell(),
        });
    }

    // ----- weekly claim -----
    // Design note: resetting current_cycle_start on EVERY claim would allow only one
    // claimer per epoch. Here many holders claim inside the same 24h window; the cycle
    // rolls forward when the window expires (lazy on next interaction).

    receive(msg: ClaimReward) {
        require(!self.isBlacklisted(sender()), "Blacklisted");
        // Owner holds launch liquidity / residual supply — must not drain the claim pool.
        require(sender() != self.owner, "Owner cannot claim");
        require(self.claimProgramActive, "Claim not active");
        require(self.isSellEnabled, "Sells not enabled");

        self.maybeOpenClaimWindow();

        require(self.claimWindowOpened, "Claim window closed");
        let windowEnd: Int = self.currentCycleStart + self.claimPeriodSeconds + CLAIM_WINDOW_SECONDS;
        require(now() <= windowEnd, "Claim window expired");

        let infoOpt: HolderInfo? = self.holders.get(sender());
        require(infoOpt != null, "Not a holder");
        let info: HolderInfo = infoOpt!!;
        require(info.balance > 0, "Zero balance");
        require(info.claimedCycleId != self.currentCycleId, "Already claimed");

        require(self.claimPoolSnapshot > 0, "Empty claim pool");
        require(self.totalSupply > 0, "Zero supply");

        let rawShare: Int = (self.claimPoolSnapshot * info.balance) / self.totalSupply;

        // Full reward if tokens were held intact (min never below period start)
        let eligibleFull: Bool = (info.periodStartBalance > 0) && (info.minBalancePeriod >= info.periodStartBalance);
        let payout: Int = rawShare;
        if (!eligibleFull) {
            payout = (rawShare * ANTI_SNIPER_PENALTY_BP) / BP_DENOMINATOR;
        }
        require(payout > 0, "Payout too small");
        require(payout <= self.treasuryGramBalance, "Treasury underflow");

        self.treasuryGramBalance -= payout;
        self.holders.set(sender(), HolderInfo{
            balance: info.balance,
            lastUpdate: now(),
            minBalancePeriod: info.minBalancePeriod,
            periodStartBalance: info.periodStartBalance,
            claimedCycleId: self.currentCycleId,
        });

        send(SendParameters{
            to: sender(),
            value: payout,
            mode: SendPayGasSeparately,
            bounce: false,
            body: "AWN claim".asComment(),
        });
    }

    // ----- getters (Telegram Mini App) -----

    get fun get_jetton_data(): JettonData {
        return JettonData{
            totalSupply: self.totalSupply,
            mintable: self.mintable,
            owner: self.owner,
            content: self.content,
            jettonWalletCode: codeOf AwanWallet,
        };
    }

    get fun get_wallet_address(ownerAddress: Address): Address {
        return self.walletAddress(ownerAddress);
    }

    get fun get_treasury_balance(): Int {
        return self.treasuryGramBalance;
    }

    get fun get_holder_info(account: Address): HolderInfo {
        let info: HolderInfo? = self.holders.get(account);
        if (info == null) {
            return HolderInfo{
                balance: 0,
                lastUpdate: 0,
                minBalancePeriod: 0,
                periodStartBalance: 0,
                claimedCycleId: 0,
            };
        }
        return info!!;
    }

    get fun get_claim_status(): ClaimStatus {
        let open: Bool = self.claimWindowOpened;
        let windowEnd: Int = 0;
        if (self.currentCycleStart > 0) {
            let elapsed: Int = now() - self.currentCycleStart;
            windowEnd = self.currentCycleStart + self.claimPeriodSeconds + CLAIM_WINDOW_SECONDS;
            if (!open && self.claimProgramActive && elapsed >= self.claimPeriodSeconds && elapsed < (self.claimPeriodSeconds + CLAIM_WINDOW_SECONDS)) {
                open = true;
            }
        }
        return ClaimStatus{
            cycleId: self.currentCycleId,
            cycleStart: self.currentCycleStart,
            claimWindowOpen: open,
            claimWindowEnd: windowEnd,
            treasuryBalance: self.treasuryGramBalance,
            claimPoolSnapshot: self.claimPoolSnapshot,
            sellsEnabled: self.isSellEnabled,
            claimProgramActive: self.claimProgramActive,
        };
    }

    get fun get_trading_state(): AwanConfig {
        return self.buildConfig();
    }

    get fun get_pending_tax_jettons(): Int {
        return self.pendingTaxJettons;
    }

    get fun is_blacklisted(account: Address): Bool {
        return self.isBlacklisted(account);
    }

    get fun get_max_batch_transfer_amount(): Int {
        return self.maxBatchTransferAmount;
    }
}
