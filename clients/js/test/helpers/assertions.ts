import { expect } from 'vitest';

// Custom assertion helpers
// This file will contain custom assertions for testing Solana programs and account states 

/**
 * Custom assertion helper that logs the result of each test
 * @param actual The actual value received
 * @param expected The expected value
 * @param message Description of what is being tested
 */
export function assertWithLog<T>(actual: T, expected: T, message: string): void {
    try {
        expect(actual).toBe(expected);
        console.log(`✅ ${message}: PASSED`);
    } catch (error) {
        console.error(`❌ ${message}: FAILED`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Received: ${actual}`);
        throw error;
    }
}

/**
 * Custom assertion helper for bigint values that logs the result
 * @param actual The actual bigint value received
 * @param expected The expected bigint value
 * @param message Description of what is being tested
 */
export function assertBigIntWithLog(actual: bigint, expected: bigint, message: string): void {
    try {
        expect(actual).toBe(expected);
        console.log(`✅ ${message}: PASSED (${actual})`);
    } catch (error) {
        console.error(`❌ ${message}: FAILED`);
        console.error(`   Expected: ${expected}n`);
        console.error(`   Received: ${actual}n`);
        throw error;
    }
}

/**
 * Custom assertion helper for boolean values that logs the result
 * @param actual The actual boolean value received
 * @param expected The expected boolean value
 * @param message Description of what is being tested
 */
export function assertBooleanWithLog(actual: boolean, expected: boolean, message: string): void {
    try {
        expect(actual).toBe(expected);
        console.log(`✅ ${message}: PASSED (${actual})`);
    } catch (error) {
        console.error(`❌ ${message}: FAILED`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Received: ${actual}`);
        throw error;
    }
}

/**
 * Custom assertion helper for number values that logs the result
 * @param actual The actual number value received
 * @param expected The expected number value
 * @param message Description of what is being tested
 */
export function assertNumberWithLog(actual: number, expected: number, message: string): void {
    try {
        expect(actual).toBe(expected);
        console.log(`✅ ${message}: PASSED (${actual})`);
    } catch (error) {
        console.error(`❌ ${message}: FAILED`);
        console.error(`   Expected: ${expected}`);
        console.error(`   Received: ${actual}`);
        throw error;
    }
} 