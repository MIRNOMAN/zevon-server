import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyService } from './currency.service.js';

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CurrencyService],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getRates', () => {
    it('should return exchange rates table with base BDT', () => {
      const rates = service.getRates();
      expect(rates.baseCurrency).toBe('BDT');
      expect(rates.supportedCurrencies).toHaveLength(4);
    });
  });

  describe('convert', () => {
    it('should convert BDT to USD accurately', () => {
      const result = service.convert({
        amount: 2500,
        from: 'BDT',
        to: 'USD',
      });

      expect(result.originalAmount).toBe(2500);
      expect(result.fromCurrency).toBe('BDT');
      expect(result.toCurrency).toBe('USD');
      expect(result.convertedAmount).toBe(21); // 2500 * 0.0084 = 21.00
      expect(result.formatted).toContain('$21.00 USD');
    });

    it('should convert USD to BDT accurately', () => {
      const result = service.convert({
        amount: 10,
        from: 'USD',
        to: 'BDT',
      });

      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('BDT');
      expect(result.convertedAmount).toBeCloseTo(1190.48, 1);
    });
  });

  describe('detectLocation', () => {
    it('should detect country from cf-ipcountry header and recommend localized currency', () => {
      const bdResult = service.detectLocation({ 'cf-ipcountry': 'BD' });
      expect(bdResult.recommendedCurrency).toBe('BDT');
      expect(bdResult.symbol).toBe('৳');

      const ukResult = service.detectLocation({ 'cf-ipcountry': 'GB' });
      expect(ukResult.recommendedCurrency).toBe('GBP');
      expect(ukResult.symbol).toBe('£');

      const euResult = service.detectLocation({ 'cf-ipcountry': 'DE' });
      expect(euResult.recommendedCurrency).toBe('EUR');
      expect(euResult.symbol).toBe('€');
    });
  });
});
