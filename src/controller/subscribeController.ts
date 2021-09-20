import { Plan, ErrorLog } from '../models';
import { RequestHandler, Request, Response} from 'express';
const stripe = require('stripe')(process.env.STRIPE_SECRET);

//webhook
export const stripeWebhook: RequestHandler = async (req: Request, res: Response) => {
  try {
    let event = stripe.webhooks.constructEvent(
        req.body,
        req.headers['stripe-signature'],
        process.env.STRIPE_WEBHOOK_SECRET
    );
    
    const dataObject = event.data.object;

    console.log(dataObject);

    switch (event.type) {
      case 'invoice.paid':
        console.log(event.type)
        console.log(`From invoice.paid`);
        // Used to provision services after the trial has ended.
        // The status of the invoice will show up as paid. Store the status in your
        // database to reference when a user accesses your service to avoid hitting rate limits.
        break;
      case 'invoice.payment_failed':
        console.dir(event.type);
        console.log(`From payment failed`);
        // If the payment fails or the customer does not have a valid payment method,
        //  an invoice.payment_failed event is sent, the subscription becomes past_due.
        // Use this webhook to notify your user that their payment has
        // failed and to retrieve new card details.
        break;
      case 'customer.subscription.deleted':
        if (event.request != null) {
          console.log(event.request);
          // handle a subscription cancelled by your request
          // from above.
        } else {
          // handle subscription cancelled automatically based
          // upon your subscription settings.
        }
        break;
      default:
      // Unexpected event type
    }

    return res.sendStatus(200);
    
  } catch (error: any) {
    const new_error = await new ErrorLog({ type: 'stripe_webhook', message: error.message });
    await new_error.save();
      // return res.sendStatus(400);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
}

/**
 * create subscription for user
 * @param req 
 * @param res 
 * @returns 
 */
export const createSubscription: RequestHandler = async (req: Request, res: Response) => {
  const { priceId, paymentMethodId } = req.body;
  const { id } = req.user;
  try {
    const plan = await Plan.findOne().where('user.id').equals(id);
    if (!plan || plan === null) return res.status(401).json({
      success: false,
      message: "Unable to process your subscription. Please try again"
    });

    //attach payment method to customer
    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: plan.stripeId
      });
    } catch (error: any) {
      return res.status(402).json({
        success: false,
        message: error.message
      });
    }

    //change the default invoice settings to new payment method
    await stripe.customers.update(plan.stripeId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    //create subscription
    const subscription = await stripe.subscriptions.create({
      customer: plan.stripeId,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent'],
    });

    //save subscription id to db
    const update = {
      subscriptionId: subscription.id,
      priceId: priceId,
      product: subscription.items.data[0].product,
      url: subscription.items.url,
      status: subscription.status
    };
    console.log(update);
    const ui = await Plan.updateOne({ _id: plan._id }, update, { new: true });
    console.log(ui);
    return res.status(200).json({
      success: true,
      data: {
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice.payment_intent.client_secret
      }
    })
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
}

//retry subscription - incase of cancellation, 
//failed card and new card
export const retrySubscription: RequestHandler = async (req: Request, res: Response) => {
  const { paymentMethodId } = req.body;
  const { id } = req.user;
  try {
    const plan = await Plan.findOne().where('user.id').equals(id);
    if (!plan || plan === null) return res.status(401).json({
      success: false,
      message: "Unable to process your subscription"
    });

    try {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: plan.stripeId,
      });
      await stripe.customers.update(plan.stripeId, {
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
      });
    } catch (error: any) {
      // in case card_decline error
      return res.status(402).json({
        success: false,
        message: error.message
      })
    }

    const invoice = await stripe.invoices.retrieve(plan.invoiceId, {
      expand: ['payment_intent']
    });

    return res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
}

//active subscriptions
export const activeSubscription: RequestHandler = async (req: Request, res: Response) => {
  const { id } = req.user;
  try {
    const plan = await Plan.findOne().where('user.id').equals(id);
    if (!plan || plan === null) return res.status(401).json({
      success: false,
      message: "There is a problem getting your record"
    });

    return res.status(200).json({
      success: true,
      data: {
        status: plan.status,
        priceId: plan.priceId
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    });
  }
}

//cancel subscription
export const cancelSubscription: RequestHandler = async (req: Request, res: Response) => {
  const { id } = req.user;
  try {
    const plan = await Plan.findOne().where('user.id').equals(id);
    if (!plan || plan === null) return res.status(401).json({
      success: false,
      message: "Unable to process your request. Please try again later"
    });

    const deleteSub = await stripe.subscriptions.del(plan.subscriptionId);
    return res.status(200).json({
      success: true,
      data: deleteSub
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error"
    })
  }
}