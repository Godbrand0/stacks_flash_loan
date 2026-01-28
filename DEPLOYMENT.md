# Clarity Contract Deployment Guide

This guide provides step-by-step instructions for deploying the Stacks Flash Loan smart contracts to different networks.

## Prerequisites

Before deploying, ensure you have:

1. [Node.js](https://nodejs.org/) installed (v16 or higher)
2. [Clarinet CLI](https://github.com/hirosystems/clarinet) installed
3. [Stacks Wallet](https://www.hiro.so/wallet) with STX for deployment fees
4. Access to the [Stacks Blockchain](https://explorer.stacks.co/)

## Network Environments

The Stacks Flash Loan contracts can be deployed to:

1. **Mainnet**: The production Stacks blockchain
2. **Testnet**: The public test network
3. **Simnet**: Local development environment

## Configuration Files

### Mainnet Configuration

Create `settings/Mainnet.toml`:

```toml
[network]
name = "mainnet"

[node]
rpc_url = "https://api.mainnet.hiro.so"
stacks_api_rpc_url = "https://api.mainnet.hiro.so"

[accounts.deployer]
mnemonic = "your wallet mnemonic phrase"

[deployment]
fee_rate = 10000
```

### Testnet Configuration

Create `settings/Testnet.toml`:

```toml
[network]
name = "testnet"

[node]
rpc_url = "https://api.testnet.hiro.so"
stacks_api_rpc_url = "https://api.testnet.hiro.so"

[accounts.deployer]
mnemonic = "your testnet wallet mnemonic phrase"

[deployment]
fee_rate = 1000
```

### Simnet Configuration

Use the existing `settings/Devnet.toml` for local development:

```toml
[network]
name = "simnet"

[node]
rpc_url = "http://localhost:3999"
stacks_api_rpc_url = "http://localhost:3999"

[accounts.deployer]
mnemonic = "deploy with secrets"

[deployment]
fee_rate = 0
```

## Deployment Steps

### 1. Prepare Contracts

Ensure your contracts are compiled and ready:

```bash
# Check contract syntax
clarinet check

# Run tests to verify functionality
npm test
```

### 2. Deploy to Simnet (Local Testing)

```bash
# Start local blockchain
clarinet console

# In the console, deploy contracts
::deploy-contracts::flasher.clar
::deploy-contracts::flashloans-trait.clar
::deploy-contracts::mock-flash-recipient.clar
::deploy-contracts::mock-token.clar
```

### 3. Deploy to Testnet

```bash
# Deploy to testnet
clarinet deploy --testnet

# Or specify the testnet file explicitly
clarinet deploy --settings settings/Testnet.toml
```

### 4. Deploy to Mainnet

```bash
# Deploy to mainnet (use with caution!)
clarinet deploy --mainnet

# Or specify the mainnet file explicitly
clarinet deploy --settings settings/Mainnet.toml
```

## Contract Deployment Order

Deploy contracts in this specific order to ensure dependencies are resolved correctly:

1. **flashloans-trait.clar** - Trait definitions (no dependencies)
2. **mock-token.clar** - SIP010 token implementation (no dependencies)
3. **flasher.clar** - Main flash loan provider (depends on traits)
4. **mock-flash-recipient.clar** - Example recipient (depends on traits and token)

## Post-Deployment Verification

After deployment, verify your contracts:

### 1. Check Contract Existence

```bash
# Using Stacks CLI
stx call_contract <contract-id> get-name

# Using Clarinet
clarinet console
::get-contract-info <contract-id>
```

### 2. Verify Contract State

```bash
# Check initial state
stx call_contract <flasher-contract-id> get-stx-flash-fees-pips
stx call_contract <flasher-contract-id> get-sip010-flash-fees-pips
```

### 3. Test Functionality

Deploy a small test transaction to verify:

```bash
# Test STX flash loan
stx call_contract <flasher-contract-id> flash-stx <amount> <recipient>

# Test token flash loan
stx call_contract <flasher-contract-id> flash-sip010 <token-contract-id> <amount> <recipient>
```

## Contract Addresses

After deployment, note your contract addresses:

- **Mainnet**: Permanent addresses on the production blockchain
- **Testnet**: Addresses that persist on the test network
- **Simnet**: Temporary addresses for local testing

## Monitoring and Maintenance

### 1. Contract Monitoring

Monitor your deployed contracts using:

- [Stacks Explorer](https://explorer.stacks.co/)
- [Hiro API](https://www.hiro.so/api)
- Custom monitoring tools

### 2. Fee Management

Monitor and adjust fees as needed:

```bash
# Check current fees
stx call_contract <flasher-contract-id> get-stx-flash-fees-pips
stx call_contract <flasher-contract-id> get-sip010-flash-fees-pips

# Update fees (if needed)
stx call_contract <flasher-contract-id> set-fees <new-stx-fee> <new-sip010-fee>
```

## Security Considerations

1. **Secure Your Mnemonic**: Never commit mnemonic phrases to version control
2. **Test Thoroughly**: Always test on testnet before mainnet deployment
3. **Monitor Activity**: Regularly check contract activity for unusual patterns
4. **Backup Keys**: Maintain secure backups of deployment keys
5. **Use Hardware Wallets**: Consider using hardware wallets for mainnet deployments

## Troubleshooting

### Common Issues

1. **Insufficient Balance**: Ensure your deployer wallet has enough STX for fees
2. **Contract Size**: Large contracts may need to be split into multiple files
3. **Network Issues**: Check RPC endpoints and network connectivity
4. **Nonce Errors**: Wait for previous transactions to confirm before redeploying

### Error Resolution

```bash
# Reset simnet state
clarinet console
::reset_chain

# Clear cache
rm -rf .cache

# Rebuild contracts
clarinet build
```

## Advanced Deployment

### Multi-Signature Deployments

For additional security, use multi-signature deployments:

```toml
[accounts.deployer]
mnemonic = "primary mnemonic"
signers = [
    "secondary-public-key-1",
    "secondary-public-key-2"
]
required_signatures = 2
```

### Upgrade Strategy

For contract upgrades:

1. Deploy new contract version
2. Migrate state from old contract
3. Update references in dependent contracts
4. Decommission old contract (if safe)

## Resources

- [Clarinet Documentation](https://clarinet.hiro.so/)
- [Stacks Blockchain API](https://www.hiro.so/api)
- [Contract Deployment Guide](https://docs.stacks.co/smart-contracts/developer-guide)
- [Stacks Explorer](https://explorer.stacks.co/)

## Support

For deployment issues:

1. Check existing [GitHub Issues](https://github.com/Godbrand0/stacks_flash_loan/issues)
2. Create new issue with detailed error information
3. Join community discussions for additional support

---

**Note**: Always test thoroughly on testnet before deploying to mainnet. Deployment fees are non-refundable and mainnet transactions are permanent.
