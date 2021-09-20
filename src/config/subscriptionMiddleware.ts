import { Plan } from "../models";
import { RequestHandler, Request, Response, NextFunction } from 'express';
import moment from 'moment';

/**
 * Check if subscription is still valid
 * @param req 
 * @param res 
 * @param next 
 * @returns 
 */
export const validateSubscription: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const { id } = req.user;
  try {
    const plan = await Plan.findOne().where('user.id').equals(id);
    if (!plan || plan === null) return res.status(401).json({
      success: false,
      message: "Unable to verify your subscription"
    });

    const timeEnter: Date = moment().toDate();
    // you can add the number of days your subscription 
    //will be valid for
    const a: Date = moment(plan.createdAt).add(1, 'days').toDate();
    const timeUp: Boolean = moment(timeEnter).isAfter(a);

    //check if user is stil in trial period
    if (plan.type === 'trial' && timeUp === false) return next();
    
    //if user is still under trial period and subscription not active
    if (plan.status !== 'active' && plan.type === 'trial') return res.status(400).json({
        success: false,
        message: "You must upgrade your plan to continue using Plantom"
    });

    //if user subscription is not active
    if (plan.status !== 'active') return res.status(400).json({
      success: false,
      message: "Your subscription was unsuccessful"
  });
    
    // return next since both condition above is not met
    //this means plan is active
    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
}