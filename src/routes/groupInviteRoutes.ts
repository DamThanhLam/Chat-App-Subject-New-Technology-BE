// // routes/groupInvite.route.ts
// import express, { Request, Response } from "express";
// import { sendGroupInvite } from "../services/GroupInviteService";

// const router = express.Router();

// /**
//  * POST /api/group-invite
//  * Body: { senderId, receiverId, conversationId }
//  */
// router.post("/", async (req: Request, res: Response) => {
//   const { senderId, receiverId, conversationId } = req.body;

//   try {
//     const result = await sendGroupInvite({ senderId, receiverId, conversationId });
//     res.status(200).json(result);
//   } catch (error: any) {
//     res.status(400).json({ error: error.message });
//   }
// });

// export default router;
