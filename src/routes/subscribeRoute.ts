import express from 'express';
import isAuthenticated from '../config/isAuthenticated';
import {
  stripeWebhook, createSubscription,
  retrySubscription, cancelSubscription, activeSubscription,
} from '../controller/subscribeController';
const subscribeRoute = express.Router();

subscribeRoute.post('/', stripeWebhook);
subscribeRoute.post('/create', isAuthenticated, createSubscription);
subscribeRoute.get('/plan', isAuthenticated, activeSubscription);
subscribeRoute.post('/retry', isAuthenticated, retrySubscription);
subscribeRoute.post('/cancel', isAuthenticated, cancelSubscription);

export default subscribeRoute;