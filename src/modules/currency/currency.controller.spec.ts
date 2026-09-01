/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyController } from './currency.controller.js';
import { CurrencyService } from './currency.service.js';

describe('CurrencyController', () => {
  let controller: CurrencyController;
  let service: jest.Mocked<CurrencyService>;

  beforeEach(async () => {
    const serviceMock = {
      getRates: jest.fn().mockReturnValue({ baseCurrency: 'BDT', supportedCurrencies: [] }),
      convert: jest.fn().mockReturnValue({ convertedAmount: 21, formatted: '$21.00 USD' }),
      detectLocation: jest.fn().mockReturnValue({ detectedCountry: 'BD', recommendedCurrency: 'BDT' }),
      updateRates: jest.fn().mockReturnValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurrencyController],
      providers: [{ provide: CurrencyService, useValue: serviceMock }],
    }).compile();

    controller = module.get<CurrencyController>(CurrencyController);
    service = module.get(CurrencyService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('GET /currency/rates should delegate to service.getRates', () => {
    const res = controller.getRates();
    expect(service.getRates).toHaveBeenCalled();
    expect(res.baseCurrency).toBe('BDT');
  });

  it('GET /currency/convert should delegate to service.convert', () => {
    const dto = { amount: 2500, from: 'BDT', to: 'USD' };
    const res = controller.convert(dto);
    expect(service.convert).toHaveBeenCalledWith(dto);
    expect(res.convertedAmount).toBe(21);
  });
});
