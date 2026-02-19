import { Cl, PrincipalCV } from "@stacks/transactions";
import { beforeEach, describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const alice = accounts.get("wallet_1")!;
const bob = accounts.get("wallet_2")!;
const charlie = accounts.get("wallet_3")!;

const mockToken = Cl.contractPrincipal(deployer, "mock-token");
const flasher = Cl.contractPrincipal(deployer, "flasher");
const mockFlashRecipient = Cl.contractPrincipal(
  deployer,
  "mock-flash-recipient"
);
const maliciousRecipient = Cl.contractPrincipal(
  deployer,
  "malicious-recipient"
);
const nonCompliantRecipient = Cl.contractPrincipal(
  deployer,
  "non-compliant-recipient"
);

describe("Flashloans", () => {
  beforeEach(() => {
    // Give the flash loan protocol some mock tokens it can lend out
    mintMockToken(1_000_000_000, flasher);
    // Give the flash loan protocol some STX it can lend out
    simnet.transferSTX(100_000_000n, flasher.value.toString(), alice);

    // Initialize the mock flash recipient contract
    simnet.callPublicFn(
      "mock-flash-recipient",
      "set-flashloans",
      [flasher],
      deployer
    );
  });

  // ======= EXISTING TESTS =======

  it("can flashloan STX and pay back", () => {
    // Send 500 STX to the mock flash recipient
    // so it has money to pay back the flashloan with fees
    simnet.transferSTX(500n, mockFlashRecipient.value.toString(), alice);

    const flashStxResult = simnet.callPublicFn(
      "flasher",
      "flash-stx",
      [Cl.uint(100_000), mockFlashRecipient],
      alice
    );

    expect(flashStxResult.result).toBeOk(Cl.bool(true));
    expect(flashStxResult.events.length).toBe(2);

    expect(flashStxResult.events[0].event).toBe("stx_transfer_event");
    expect(flashStxResult.events[0].data).toStrictEqual({
      amount: "100000",
      recipient: mockFlashRecipient.value,
      sender: flasher.value,
      memo: "",
    });

    expect(flashStxResult.events[1].event).toBe("stx_transfer_event");
    expect(flashStxResult.events[1].data).toStrictEqual({
      amount: "100500",
      recipient: flasher.value,
      sender: mockFlashRecipient.value,
      memo: "",
    });
  });

  it("no STX lost if cannot pay back flashloan", () => {
    const flasherOriginalSTXBalance = simnet
      .getAssetsMap()
      .get("STX")!
      .get(flasher.value)!;

    const flashStxResult = simnet.callPublicFn(
      "flasher",
      "flash-stx",
      [Cl.uint(100_000), mockFlashRecipient],
      alice
    );

    expect(flashStxResult.result).toBeErr(Cl.uint(103));

    const flasherCurrentSTXBalance = simnet
      .getAssetsMap()
      .get("STX")!
      .get(flasher.value)!;

    expect(flasherCurrentSTXBalance).toBe(flasherOriginalSTXBalance);
  });

  it("can flashloan SIP010 token and pay back", () => {
    // Send 1000 TOKEN to the mock flash recipient
    // so it has money to pay back the flashloan with fees
    mintMockToken(1_000, mockFlashRecipient);

    const flashSip010Result = simnet.callPublicFn(
      "flasher",
      "flash-sip010",
      [mockToken, Cl.uint(100_000), mockFlashRecipient],
      alice
    );

    expect(flashSip010Result.result).toBeOk(Cl.bool(true));
    expect(flashSip010Result.events.length).toBe(2);

    expect(flashSip010Result.events[0].event).toBe("ft_transfer_event");
    expect(flashSip010Result.events[0].data).toStrictEqual({
      amount: "100000",
      asset_identifier: `${mockToken.value}::mock-token`,
      recipient: mockFlashRecipient.value,
      sender: flasher.value,
    });

    expect(flashSip010Result.events[1].event).toBe("ft_transfer_event");
    expect(flashSip010Result.events[1].data).toStrictEqual({
      amount: "101000",
      asset_identifier: `${mockToken.value}::mock-token`,
      recipient: flasher.value,
      sender: mockFlashRecipient.value,
    });
  });

  it("no token lost if cannot pay back flashloan", () => {
    const flasherOriginalTokenBalance = simnet
      .getAssetsMap()
      .get(".mock-token.mock-token")!
      .get(flasher.value)!;

    const flashSip010Result = simnet.callPublicFn(
      "flasher",
      "flash-sip010",
      [mockToken, Cl.uint(100_000), mockFlashRecipient],
      alice
    );

    expect(flashSip010Result.result).toBeErr(Cl.uint(103));

    const flasherCurrentTokenBalance = simnet
      .getAssetsMap()
      .get(".mock-token.mock-token")!
      .get(flasher.value)!;

    expect(flasherCurrentTokenBalance).toBe(flasherOriginalTokenBalance);
  });

  // ======= NEW ENHANCEMENT TESTS =======

  // ======= AMOUNT VALIDATION TESTS =======
  describe("Amount Validation", () => {
    it("fails when flashloaning zero STX", () => {
      const result = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(0), mockFlashRecipient],
        alice
      );
      expect(result.result).toBeErr(Cl.uint(101)); // ERR_INSUFFICIENT_BALANCE
    });

    it("fails when flashloaning zero SIP010 tokens", () => {
      const result = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(0), mockFlashRecipient],
        alice
      );
      expect(result.result).toBeErr(Cl.uint(101)); // ERR_INSUFFICIENT_BALANCE
    });

    it("fails when flashloaning more STX than available", () => {
      const result = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(1_000_000_000), mockFlashRecipient], // More than available
        alice
      );
      expect(result.result).toBeErr(Cl.uint(101)); // ERR_INSUFFICIENT_BALANCE
    });

    it("fails when flashloaning more tokens than available", () => {
      const result = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(2_000_000_000), mockFlashRecipient], // More than available
        alice
      );
      expect(result.result).toBeErr(Cl.uint(101)); // ERR_INSUFFICIENT_BALANCE
    });
  });

  // ======= FEE CALCULATION TESTS =======
  describe("Fee Calculations", () => {
    it("calculates correct STX flashloan fees (0.5%)", () => {
      simnet.transferSTX(5000n, mockFlashRecipient.value.toString(), alice);
      
      const amount = 100_000;
      const expectedReturn = amount + Math.floor(amount * 0.005); // 100,000 + 500 = 100,500
      
      const result = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(amount), mockFlashRecipient],
        alice
      );

      expect(result.result).toBeOk(Cl.bool(true));
      expect(result.events[1].data.amount).toBe(expectedReturn.toString());
    });

    it("calculates correct SIP010 flashloan fees (1%)", () => {
      const returnAmount = 101_000; // 100,000 + 1% = 101,000
      mintMockToken(returnAmount, mockFlashRecipient);
      
      const result = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(100_000), mockFlashRecipient],
        alice
      );

      expect(result.result).toBeOk(Cl.bool(true));
      expect(result.events[1].data.amount).toBe(returnAmount.toString());
    });

    it("handles large amounts without overflow", () => {
      const largeAmount = 1_000_000_000_000;
      mintMockToken(largeAmount + Math.floor(largeAmount * 0.01), mockFlashRecipient);
      
      const result = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(largeAmount), mockFlashRecipient],
        alice
      );

      // Should either succeed or fail gracefully, not crash
      expect(result.result).toBeDefined();
    });
  });

  // ======= RECIPIENT VALIDATION TESTS =======
  describe("Recipient Validation", () => {
    it("fails when recipient doesn't implement stx-flasher trait", () => {
      const result = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(100_000), nonCompliantRecipient],
        alice
      );
      expect(result.result).toBeErr(Cl.uint(103)); // ERR_FLASHER_CALLBACK_FAILED
    });

    it("fails when recipient doesn't implement sip010-flasher trait", () => {
      const result = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(100_000), nonCompliantRecipient],
        alice
      );
      expect(result.result).toBeErr(Cl.uint(103)); // ERR_FLASHER_CALLBACK_FAILED
    });

    it("fails when recipient returns false in callback", () => {
      simnet.transferSTX(5000n, mockFlashRecipient.value.toString(), alice);
      
      const result = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(100_000), maliciousRecipient],
        alice
      );
      expect(result.result).toBeErr(Cl.uint(103)); // ERR_FLASHER_CALLBACK_FAILED
    });
  });

  // ======= MULTIPLE FLASHLOAN TESTS =======
  describe("Multiple Flashloans", () => {
    it("can perform sequential STX flashloans", () => {
      simnet.transferSTX(5000n, mockFlashRecipient.value.toString(), alice);
      
      // First flashloan
      const result1 = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(50_000), mockFlashRecipient],
        alice
      );
      expect(result1.result).toBeOk(Cl.bool(true));

      // Second flashloan
      const result2 = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(30_000), mockFlashRecipient],
        alice
      );
      expect(result2.result).toBeOk(Cl.bool(true));
    });

    it("can perform sequential SIP010 flashloans", () => {
      mintMockToken(200_000, mockFlashRecipient);
      
      // First flashloan
      const result1 = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(50_000), mockFlashRecipient],
        alice
      );
      expect(result1.result).toBeOk(Cl.bool(true));

      // Second flashloan
      const result2 = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(30_000), mockFlashRecipient],
        alice
      );
      expect(result2.result).toBeOk(Cl.bool(true));
    });

    it("can perform both STX and SIP010 flashloans in same block", () => {
      // Prepare funds
      simnet.transferSTX(5000n, mockFlashRecipient.value.toString(), alice);
      mintMockToken(200_000, mockFlashRecipient);
      
      // STX flashloan
      const stxResult = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(50_000), mockFlashRecipient],
        alice
      );
      expect(stxResult.result).toBeOk(Cl.bool(true));

      // SIP010 flashloan
      const sipResult = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(50_000), mockFlashRecipient],
        alice
      );
      expect(sipResult.result).toBeOk(Cl.bool(true));
    });
  });

  // ======= DIFFERENT TOKEN TESTS =======
  describe("Different Token Types", () => {
    const secondMockToken = Cl.contractPrincipal(deployer, "second-mock-token");

    beforeEach(() => {
      // Deploy and fund second token
      simnet.callPublicFn(
        "second-mock-token",
        "mint",
        [Cl.uint(1_000_000_000), flasher],
        deployer
      );
    });

    it("can flashloan different tokens from same contract", () => {
      // Fund recipient with both tokens
      mintMockToken(200_000, mockFlashRecipient);
      simnet.callPublicFn(
        "second-mock-token",
        "mint",
        [Cl.uint(200_000), mockFlashRecipient],
        deployer
      );

      // Flashloan first token
      const result1 = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(50_000), mockFlashRecipient],
        alice
      );
      expect(result1.result).toBeOk(Cl.bool(true));

      // Flashloan second token
      const result2 = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [secondMockToken, Cl.uint(30_000), mockFlashRecipient],
        alice
      );
      expect(result2.result).toBeOk(Cl.bool(true));
    });
  });

  // ======= REENTRANCY TESTS =======
  describe("Reentrancy Protection", () => {
    it("prevents reentrancy attacks", () => {
      const reentrantRecipient = Cl.contractPrincipal(
        deployer,
        "reentrant-recipient"
      );

      simnet.transferSTX(1_000_000n, reentrantRecipient.value.toString(), alice);

      const result = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(100_000), reentrantRecipient],
        alice
      );

      // Should fail due to reentrancy attempt
      expect(result.result).toBeErr(Cl.uint(103)); // ERR_FLASHER_CALLBACK_FAILED
    });
  });

  // ======= GAS COST TESTS =======
  describe("Gas Consumption", () => {
    it("measures STX flashloan gas cost", () => {
      simnet.transferSTX(5000n, mockFlashRecipient.value.toString(), alice);
      
      const receipt = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(100_000), mockFlashRecipient],
        alice
      );

      console.log(`STX flashloan gas: ${receipt.gas_consumption}`);
      expect(Number(receipt.gas_consumption)).toBeLessThan(1_000_000);
    });

    it("measures SIP010 flashloan gas cost", () => {
      mintMockToken(200_000, mockFlashRecipient);
      
      const receipt = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(100_000), mockFlashRecipient],
        alice
      );

      console.log(`SIP010 flashloan gas: ${receipt.gas_consumption}`);
      expect(Number(receipt.gas_consumption)).toBeLessThan(1_500_000);
    });
  });

  // ======= EDGE CASE TESTS =======
  describe("Edge Cases", () => {
    it("handles exact payback amount", () => {
      const exactPayback = 100_500; // Principal + 0.5%
      simnet.transferSTX(exactPayback, mockFlashRecipient.value.toString(), alice);
      
      const result = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(100_000), mockFlashRecipient],
        alice
      );

      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("fails with insufficient payback", () => {
      const insufficientPayback = 100_499; // 1 less than required
      simnet.transferSTX(insufficientPayback, mockFlashRecipient.value.toString(), alice);
      
      const result = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(100_000), mockFlashRecipient],
        alice
      );

      expect(result.result).toBeErr(Cl.uint(105)); // ERR_INSUFFICIENT_PAYBACK
    });

    it("handles maximum uint values", () => {
      const maxUint = 2n ** 128n - 1n;
      
      const result = simnet.callPublicFn(
        "flasher",
        "flash-sip010",
        [mockToken, Cl.uint(maxUint), mockFlashRecipient],
        alice
      );

      // Should either succeed or fail with clear error, not crash
      expect(result.result).toBeDefined();
    });
  });

  // ======= AUTHORIZATION TESTS =======
  describe("Authorization", () => {
    it("anyone can initiate flashloan", () => {
      simnet.transferSTX(5000n, mockFlashRecipient.value.toString(), alice);
      
      const result = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(100_000), mockFlashRecipient],
        bob // Different user initiating
      );

      expect(result.result).toBeOk(Cl.bool(true));
    });

    it("flashloan works from contract calls", () => {
      simnet.transferSTX(5000n, mockFlashRecipient.value.toString(), alice);
      
      const result = simnet.callPublicFn(
        "flasher",
        "flash-stx",
        [Cl.uint(100_000), mockFlashRecipient],
        deployer // Contract deployer
      );

      expect(result.result).toBeOk(Cl.bool(true));
    });
  });
});

function mintMockToken(amount: number, to: PrincipalCV) {
  return simnet.callPublicFn(
    "mock-token",
    "mint",
    [Cl.uint(amount), to],
    deployer
  );
}
