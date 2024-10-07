import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

initializeApp();

const db = getFirestore();
const auth = getAuth();

// Enum for achievement status
enum AchievementStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

// Interface for Achievement
interface Achievement {
  id?: string;
  userId: string;
  text: string;
  imageLink?: string;
  status: AchievementStatus;
  createdAt: FirebaseFirestore.Timestamp;
}

// Function to create a new achievement
export const createAchievement = onRequest({ cors: true }, async (request, response) => {
  try {
    // Check if the request method is POST
    if (request.method !== 'POST') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    // Get the authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      response.status(401).send('Unauthorized');
      return;
    }

    // Verify the Firebase ID token
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const { text, imageLink, status } = request.body;

    if (!text || !status || !Object.values(AchievementStatus).includes(status)) {
      response.status(400).send('Invalid achievement data');
      return;
    }

    const achievement: Achievement = {
      userId,
      text,
      imageLink,
      status: status as AchievementStatus,
      createdAt: FirebaseFirestore.Timestamp.now()
    };

    const docRef = await db.collection('achievements').add(achievement);
    response.status(201).json({ id: docRef.id, ...achievement });
  } catch (error) {
    logger.error('Error creating achievement:', error);
    response.status(500).send('Internal Server Error');
  }
});

// Function to get all achievements for a user, grouped by dates
export const getAchievementsGroupedByDate = onRequest({ cors: true }, async (request, response) => {
  try {
    // Check if the request method is GET
    if (request.method !== 'GET') {
      response.status(405).send('Method Not Allowed');
      return;
    }

    // Get the authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      response.status(401).send('Unauthorized');
      return;
    }

    // Verify the Firebase ID token
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(idToken);
    const userId = decodedToken.uid;

    const snapshot = await db.collection('achievements')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    const achievements = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Achievement[];

    const groupedAchievements = achievements.reduce((acc, achievement) => {
      const date = achievement.createdAt.toDate().toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(achievement);
      return acc;
    }, {} as Record<string, Achievement[]>);

    response.status(200).json(groupedAchievements);
  } catch (error) {
    logger.error('Error retrieving achievements:', error);
    response.status(500).send('Internal Server Error');
  }
});