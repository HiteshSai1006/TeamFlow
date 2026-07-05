import * as reviewService from './review.service.js';

export async function myPending(req, res, next) {
  try {
    const actorUserId = req.user.id;
    const reviews = await reviewService.listMyPendingReviews(actorUserId);

    return res.status(200).json({
      success: true,
      reviews
    });
  } catch (error) {
    next(error);
  }
}

export async function decide(req, res, next) {
  try {
    const reviewId = parseInt(req.params.reviewId, 10);
    const { decision, comment } = req.body;
    const actorUserId = req.user.id;

    const result = await reviewService.decideReview(reviewId, { decision, comment }, actorUserId);

    return res.status(200).json({
      success: true,
      review: result.review,
      rca: result.rca
    });
  } catch (error) {
    next(error);
  }
}
