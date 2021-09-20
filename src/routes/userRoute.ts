import express from 'express';
import { createUser, getUser, allowLogin, productAccess } from '../controller/userController';
import { validateSubscription } from '../config/subscriptionMiddleware';
import isAuthenticated from '../config/isAuthenticated';
const userRoute = express.Router();

userRoute.post('/', createUser);
userRoute.get('/', isAuthenticated, getUser);
userRoute.post('/login', allowLogin);
userRoute.get('/product', isAuthenticated, validateSubscription, productAccess);

export default userRoute;