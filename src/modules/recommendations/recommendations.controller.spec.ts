/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { RecommendationsController } from './recommendations.controller.js';
import { RecommendationsService } from './recommendations.service.js';

describe('RecommendationsController', () => {
  let controller: RecommendationsController;
  let service: jest.Mocked<RecommendationsService>;

  beforeEach(async () => {
    const serviceMock = {
      trackView: jest.fn().mockResolvedValue({ recorded: true }),
      getRecentlyViewed: jest.fn().mockResolvedValue({ total: 1, items: [] }),
      getYouMayAlsoLike: jest
        .fn()
        .mockResolvedValue({ total: 1, recommendations: [] }),
      getTrending: jest.fn().mockResolvedValue({ total: 1, items: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecommendationsController],
      providers: [{ provide: RecommendationsService, useValue: serviceMock }],
    }).compile();

    controller = module.get<RecommendationsController>(
      RecommendationsController,
    );
    service = module.get(RecommendationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /recommendations/track-view should delegate to service.trackView', async () => {
    const dto = { productId: 'prod-1' };
    const res = await controller.trackView(dto, 'user-1');
    expect(service.trackView).toHaveBeenCalledWith(dto, 'user-1');
    expect(res.recorded).toBe(true);
  });

  it('GET /recommendations/you-may-also-like/:productId should delegate with default limit 8', async () => {
    const res = await controller.getYouMayAlsoLike('prod-1');
    expect(service.getYouMayAlsoLike).toHaveBeenCalledWith('prod-1', 8);
    expect(res.total).toBe(1);
  });
});
