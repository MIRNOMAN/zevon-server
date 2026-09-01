import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConvertCurrencyDto, UpdateRatesDto } from './dto/index.js';

export interface CurrencyMetadata {
  code: string;
  symbol: string;
  name: string;
  rateFromBDT: number; // 1 BDT in target currency
  rateToBDT: number; // 1 target currency in BDT
  decimalPlaces: number;
}

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);

  // In-memory real-time rates dictionary with BDT base (1.0)
  private rates: Record<string, number> = {
    BDT: 1.0,
    USD: 0.0084, // 1 USD = ~119.05 BDT
    EUR: 0.0078, // 1 EUR = ~128.20 BDT
    GBP: 0.0066, // 1 GBP = ~151.52 BDT
  };

  private readonly currencies: Record<
    string,
    { symbol: string; name: string; decimals: number }
  > = {
    BDT: { symbol: '৳', name: 'Bangladeshi Taka', decimals: 2 },
    USD: { symbol: '$', name: 'US Dollar', decimals: 2 },
    EUR: { symbol: '€', name: 'Euro', decimals: 2 },
    GBP: { symbol: '£', name: 'British Pound', decimals: 2 },
  };

  /**
   * Returns active exchange rates with metadata and formatting rules.
   */
  getRates() {
    const list: CurrencyMetadata[] = Object.keys(this.currencies).map(
      (code) => {
        const meta = this.currencies[code];
        const rateFromBDT = this.rates[code];
        const rateToBDT =
          rateFromBDT > 0 ? Number((1 / rateFromBDT).toFixed(4)) : 1;

        return {
          code,
          symbol: meta.symbol,
          name: meta.name,
          rateFromBDT,
          rateToBDT,
          decimalPlaces: meta.decimals,
        };
      },
    );

    return {
      baseCurrency: 'BDT',
      baseSymbol: '৳',
      supportedCurrencies: list,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Convert an amount between any two supported currencies in real-time.
   */
  convert(dto: ConvertCurrencyDto) {
    const { amount } = dto;
    const fromCode = (dto.from || 'BDT').toUpperCase();
    const toCode = (dto.to || 'USD').toUpperCase();

    if (!this.rates[fromCode]) {
      throw new BadRequestException(
        `Unsupported source currency "${fromCode}". Supported: BDT, USD, EUR, GBP`,
      );
    }
    if (!this.rates[toCode]) {
      throw new BadRequestException(
        `Unsupported target currency "${toCode}". Supported: BDT, USD, EUR, GBP`,
      );
    }

    // 1. Convert to Base BDT
    const rateFrom = this.rates[fromCode];
    const amountInBdt = fromCode === 'BDT' ? amount : amount / rateFrom;

    // 2. Convert from Base BDT to Target
    const rateTo = this.rates[toCode];
    const rawTargetAmount =
      toCode === 'BDT' ? amountInBdt : amountInBdt * rateTo;

    const targetMeta = this.currencies[toCode];
    const roundedAmount = Number(rawTargetAmount.toFixed(targetMeta.decimals));
    const formatted = `${targetMeta.symbol}${roundedAmount.toLocaleString(
      'en-US',
      {
        minimumFractionDigits: targetMeta.decimals,
        maximumFractionDigits: targetMeta.decimals,
      },
    )} ${toCode}`;

    return {
      originalAmount: amount,
      fromCurrency: fromCode,
      fromSymbol: this.currencies[fromCode].symbol,
      convertedAmount: roundedAmount,
      toCurrency: toCode,
      toSymbol: targetMeta.symbol,
      formatted,
      exchangeRate: Number((rateTo / rateFrom).toFixed(6)),
    };
  }

  /**
   * Geo-Location & IP detection engine:
   * Inspects HTTP headers (Cloudflare, Proxy, Client IP) and recommends localized currency.
   */
  detectLocation(
    headers: Record<string, string | string[] | undefined>,
    clientIp?: string,
  ) {
    const headerCountry =
      (headers['cf-ipcountry'] as string) ||
      (headers['x-country-code'] as string) ||
      (headers['x-client-country'] as string);

    let countryCode = (headerCountry || '').trim().toUpperCase();

    // If country header is missing, detect from common IP prefixes or fallback
    if (!countryCode) {
      if (
        clientIp?.startsWith('103.') ||
        clientIp?.startsWith('118.') ||
        clientIp?.startsWith('180.')
      ) {
        countryCode = 'BD';
      } else {
        countryCode = 'US'; // Default international fallback
      }
    }

    let recommendedCurrency = 'USD';
    let countryName = 'International';

    switch (countryCode) {
      case 'BD':
        recommendedCurrency = 'BDT';
        countryName = 'Bangladesh';
        break;
      case 'GB':
      case 'UK':
        recommendedCurrency = 'GBP';
        countryName = 'United Kingdom';
        break;
      case 'DE':
      case 'FR':
      case 'IT':
      case 'ES':
      case 'NL':
      case 'BE':
      case 'AT':
      case 'IE':
      case 'EU':
        recommendedCurrency = 'EUR';
        countryName = 'European Union';
        break;
      case 'US':
        recommendedCurrency = 'USD';
        countryName = 'United States';
        break;
      case 'CA':
        recommendedCurrency = 'USD';
        countryName = 'Canada';
        break;
      case 'AU':
        recommendedCurrency = 'USD';
        countryName = 'Australia';
        break;
      default:
        recommendedCurrency = 'USD';
        countryName = countryCode;
        break;
    }

    const currencyMeta =
      this.currencies[recommendedCurrency] || this.currencies.USD;

    return {
      detectedCountry: countryCode,
      countryName,
      recommendedCurrency,
      symbol: currencyMeta.symbol,
      currencyName: currencyMeta.name,
      exchangeRateFromBDT: this.rates[recommendedCurrency],
    };
  }

  /**
   * Admin: Update active exchange rates.
   */
  updateRates(dto: UpdateRatesDto) {
    if (dto.USD) this.rates.USD = dto.USD;
    if (dto.EUR) this.rates.EUR = dto.EUR;
    if (dto.GBP) this.rates.GBP = dto.GBP;

    this.logger.log(
      `💱 Exchange rates updated: USD=${this.rates.USD}, EUR=${this.rates.EUR}, GBP=${this.rates.GBP}`,
    );

    return this.getRates();
  }
}
