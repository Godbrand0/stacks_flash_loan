# Stacks Flash Loan

A comprehensive flash loan implementation for the Stacks blockchain, written in Clarity smart contract language.

## Overview

This project implements a flash loan protocol that allows users to borrow assets without collateral, as long as the borrowed amount plus interest is returned within the same transaction. The implementation supports both STX (the native token of Stacks) and SIP010-compliant fungible tokens.

## Flash Loans

A flash loan is a type of uncollateralized loan where borrowing and repayment must occur within the same transaction. If the loan is not repaid by the end of the transaction, the entire transaction is reverted, ensuring the lender is never at risk of losing funds.

## Architecture

The implementation consists of several key components:

### Core Contracts

1. **Flash Loan Trait** ([`contracts/flashloans-trait.clar`](contracts/flashloans-trait.clar))
   - Defines the interface that flash loan recipients must implement
   - Provides traits for both STX and SIP010 token flash loans

2. **Flash Loan Provider** ([`contracts/flasher.clar`](contracts/flasher.clar))
   - The main contract that provides flash loans
   - Handles both STX and SIP010 token flash loans
   - Enforces repayment with interest

3. **Mock Flash Recipient** ([`contracts/mock-flash-recipient.clar`](contracts/mock-flash-recipient.clar))
   - Example implementation of a flash loan recipient
   - Demonstrates how to handle flash loan callbacks
   - Includes dummy business logic for testing

4. **Mock Token** ([`contracts/mock-token.clar`](contracts/mock-token.clar))
   - Simple SIP010-compliant token for testing
   - Used to test token flash loans

## Features

- **Dual Asset Support**: Supports both STX and SIP010 tokens
- **Interest Model**: Charges interest on flash loans (0.5% for STX, 1% for SIP010 tokens)
- **Atomic Execution**: Ensures loans are either fully repaid or completely reverted
- **Secure Design**: Multiple security checks to protect against common attack vectors

## Interest Rates

- **STX Flash Loans**: 0.5% (5000 pips)
- **SIP010 Token Flash Loans**: 1% (10000 pips)

## Usage

### For STX Flash Loans

```clarity
;; Borrow 100 STX via flash loan
(contract-call? 'flasher flash-stx u100 'recipient-contract)
```

### For SIP010 Token Flash Loans

```clarity
;; Borrow 100 tokens via flash loan
(contract-call? 'flasher flash-sip010 'token-contract u100 'recipient-contract)
```

### Implementing a Flash Loan Recipient

To receive flash loans, your contract must implement the appropriate trait:

```clarity
;; For STX flash loans
(define-trait stx-flasher (
    (on-stx-flash (uint uint) (response bool uint))
))

;; For SIP010 token flash loans
(define-trait sip010-flasher (
    (on-sip010-flash (<ft-trait> uint uint) (response bool uint))
)
```

## Security Considerations

1. **Reentrancy Protection**: The implementation is designed to prevent reentrancy attacks
2. **Integer Overflow**: All calculations use safe arithmetic operations
3. **Access Control**: Only authorized contracts can initiate flash loans
4. **Atomic Execution**: Ensures funds are never at risk

## Testing

The project includes comprehensive tests in [`tests/flashloans.test.ts`](tests/flashloans.test.ts):

- Successful flash loan scenarios
- Failure scenarios and revert behavior
- Interest calculation verification
- Event emission validation

## Development

### Prerequisites

- Node.js
- Clarinet SDK

### Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage and cost reports
npm run test:report

# Watch for changes and run tests
npm run test:watch
```

## Project Structure

```
stacks_flash_loan/
├── contracts/
│   ├── flasher.clar              # Main flash loan provider
│   ├── flashloans-trait.clar      # Trait definitions
│   ├── mock-flash-recipient.clar   # Example recipient
│   └── mock-token.clar           # Test token
├── tests/
│   └── flashloans.test.ts        # Test suite
├── settings/
│   └── Devnet.toml              # Development settings
├── deployments/
│   └── default.simnet-plan.yaml   # Deployment plan
├── Clarinet.toml                 # Clarinet configuration
├── package.json                  # Node.js dependencies
└── README.md                    # This file
```

## Use Cases

Flash loans enable various DeFi strategies:

1. **Arbitrage**: Exploit price differences across markets
2. **Collateral Swapping**: Replace one type of collateral with another
3. **Self-Liquidation**: Avoid liquidation by repaying debts
4. **Yield Farming**: Access capital for yield-generating opportunities

## Future Enhancements

Potential improvements to consider:

1. **Variable Interest Rates**: Implement dynamic interest rates based on market conditions
2. **Flash Loan Pools**: Allow multiple providers to contribute to a liquidity pool
3. **Advanced Routing**: Support for complex multi-step operations
4. **Fee Distribution**: Implement mechanisms for distributing fees to liquidity providers

## License

ISC

## Contributing

Contributions are welcome! Please ensure all tests pass and follow the existing code style.

## Resources

- [Clarity Documentation](https://docs.stacks.co/clarity)
- [Clarinet Documentation](https://clarinet.hiro.so/)
- [SIP-010 Token Standard](https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md)
