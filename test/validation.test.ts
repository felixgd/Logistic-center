import { describe, it, expect } from "vitest";
import { sanitizeText, validateQuantity, validateCoordinates } from "../lib/validation";

describe("Validation Utilities", () => {
  describe("sanitizeText", () => {
    it("should escape special characters to prevent XSS", () => {
      const payload = "<script>alert('XSS')</script>";
      const sanitized = sanitizeText(payload);
      expect(sanitized).not.toContain("<script>");
      expect(sanitized).toContain("&lt;script&gt;");
      expect(sanitized).toContain("&#39;");
    });

    it("should return empty string for null or undefined", () => {
      expect(sanitizeText(null)).toBe("");
      expect(sanitizeText(undefined)).toBe("");
    });

    it("should truncate text to 500 characters", () => {
      const longText = "a".repeat(600);
      expect(sanitizeText(longText)).toHaveLength(500);
    });
  });

  describe("validateQuantity", () => {
    it("should accept valid positive integers", () => {
      const result = validateQuantity(10);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.quantity).toBe(10);
      }
    });

    it("should accept zero", () => {
      const result = validateQuantity(0);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.quantity).toBe(0);
      }
    });

    it("should reject negative numbers", () => {
      const result = validateQuantity(-5);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBeDefined();
      }
    });

    it("should reject non-numeric strings", () => {
      const result = validateQuantity("invalid_num");
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe("validateCoordinates", () => {
    it("should accept valid coordinates", () => {
      const result = validateCoordinates(10.5, -66.9);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.lat).toBe(10.5);
        expect(result.lng).toBe(-66.9);
      }
    });

    it("should allow null/undefined coordinates", () => {
      const result = validateCoordinates(null, undefined);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.lat).toBeNull();
        expect(result.lng).toBeNull();
      }
    });

    it("should reject latitude out of bounds", () => {
      const result = validateCoordinates(95.0, -66.9);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("Latitude must be between -90 and 90");
      }
    });

    it("should reject longitude out of bounds", () => {
      const result = validateCoordinates(10.5, -200.0);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("Longitude must be between -180 and 180");
      }
    });

    it("should reject non-numeric inputs", () => {
      const result = validateCoordinates("abc", -66.9);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error).toBe("Coordinates must be valid numbers");
      }
    });
  });
});
