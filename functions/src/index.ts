/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
// import * as voiceChatBot from './voice_chat_bot';
import * as taskModule from './task/task';
import { OPENAI_API_KEY } from "./configs";

admin.initializeApp();

const app = express();
app.use(cors({ origin: ['http://localhost:3000', 'https://meetyudai.com'] }));

// // Voice chat function
// export const voiceChat = onRequest({ cors: true }, async (request, response) => {
//   try {
//     logger.info('voice_chat request received');
//     const audioFile = (request as any).file;

//     if (!audioFile) {
//       return response.status(400).send('No audio data provided');
//     }

//     const openAiApiKey = process.env.OPENAI_API_KEY;
//     const voicevoxUrl = process.env.VOICEVOX_URL;

//     if (!openAiApiKey || !voicevoxUrl) {
//       throw new Error('Missing environment variables');
//     }

//     const botAudioData = await voiceChatBot.processAudio(audioFile.path, openAiApiKey, voicevoxUrl);

//     if (!botAudioData) {
//       return response.status(400).send('No response generated');
//     }

//     const botAudioBase64 = Buffer.from(botAudioData).toString('base64');
//     response.set('Content-Type', 'audio/wav').status(200).send(botAudioBase64);
//   } catch (e) {
//     logger.error(`An error occurred: ${e}`);
//     response.status(500).send(`An error occurred: ${e}`);
//   }
// });

export const testConnection = onRequest({
  cors: true,
  secrets: [OPENAI_API_KEY]  // Declare the secret dependency here
}, async (request, response) => {
  console.log('testConnection request received');
  await taskModule.testConnection();
});

// Voice task function
export const voiceTask = onRequest({
  cors: true,
  secrets: [OPENAI_API_KEY]  // Declare the secret dependency here
}, async (request, response) => {
  try {
    logger.info('voice_task request received');
    const audioFile = (request as any).file;
    const userId = request.body.user_id;
    const listId = request.body.list_id;

    logger.info('user_id:', userId);
    logger.info('list_id:', listId);

    if (!audioFile) {
      response.status(400).send('No audio data provided');
      return;
    }

    // export const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

    // const openAiApiKey = process.env.OPENAI_API_KEY;
    // if (!openAiApiKey) {
    //   throw new Error('Missing OPENAI_API_KEY environment variable');
    // }

    // const botMessage = await taskModule.processAudio(audioFile.path, openAiApiKey, userId, listId);

    const botMessage = await taskModule.processAudio(audioFile.path, userId, listId);

    if (!botMessage) {
      response.status(400).send('No response generated');
      return;
    }

    response.set('Content-Type', 'text/plain').status(200).send(botMessage);
  } catch (e) {
    logger.error(`An error occurred: ${e}`);
    response.status(500).send(`An error occurred: ${e}`);
  }
});

// Get completed tasks function
export const getCompletedTasks = onRequest({ cors: true }, async (request, response) => {
  logger.info('get_completed_tasks request received', request.query.user_id, request.query.list_id);
  const tasks = await taskModule.getCompletedTasks(request.query.user_id as string, request.query.list_id as string);
  const tasksJson = JSON.stringify(tasks);
  logger.info('completed_tasks_json:', tasksJson);
  response.status(200).json(tasks);
});

// Get incomplete tasks function
export const getIncompleteTasks = onRequest({ cors: true }, async (request, response) => {
  logger.info('get_incomplete_tasks request received', request.query.user_id, request.query.list_id);
  const tasks = await taskModule.getIncompleteTasks(request.query.user_id as string, request.query.list_id as string);
  const tasksJson = JSON.stringify(tasks);
  logger.info('incomplete_tasks_json:', tasksJson);
  response.status(200).json(tasks);
});

// Create task function
export const createTask = onRequest({ cors: true }, async (request, response) => {
  if (!request.query.task_data) {
    response.status(400).json({ message: 'Task data is required' });
    return;
  }

  logger.info('create_task triggered: ', request.query.user_id, request.query.task_data);
  const taskId = await taskModule.createTask(request.query.user_id as string, request.query.task_data as string);
  response.status(200).json({ task_id: taskId });
});

// Mark task as completed function
export const markTaskAsCompleted = onRequest({ cors: true }, async (request, response) => {
  await taskModule.markTaskAsCompleted(request.query.user_id as string, request.query.task_id as string);
  response.status(200).json({ message: 'Task completed' });
});

// Mark task as incomplete function
export const markTaskAsIncomplete = onRequest({ cors: true }, async (request, response) => {
  await taskModule.markTaskAsIncomplete(request.query.user_id as string, request.query.task_id as string);
  response.status(200).json({ message: 'Task incomplete' });
});

// Delete task function
export const deleteTask = onRequest({ cors: true }, async (request, response) => {
  await taskModule.deleteTask(request.query.user_id as string, request.query.list_id as string, request.query.task_id as string);
  response.status(200).json({ message: 'Task removed' });
});

// Get all tasks function
export const getAllTasks = onRequest({ cors: true }, async (request, response) => {
  const tasks = await taskModule.getAllTasks(request.query.user_id as string);
  response.status(200).json(tasks);
});

// Get task by ID function
export const getTask = onRequest({ cors: true }, async (request, response) => {
  const taskResp = await taskModule.getTaskById(request.query.user_id as string, request.query.task_id as string);
  response.status(200).json(taskResp);
});

// Update task name function
export const updateTaskName = onRequest({ cors: true }, async (request, response) => {
  await taskModule.updateTaskName(request.query.user_id as string, request.query.task_id as string, request.query.task_name as string);
  response.status(200).json({ message: 'Task name updated' });
});

// Update task function
export const updateTask = onRequest({ cors: true }, async (request, response) => {
  await taskModule.updateTask(request.query.user_id as string, request.query.task_id as string, request.query.task_data as string);
  response.status(200).json({ message: 'Task updated' });
});

// Create task tag function
export const createTaskTag = onRequest({ cors: true }, async (request, response) => {
  await taskModule.createTag(request.query.user_id as string, request.query.tag_name as string);
  response.status(200).json({ message: 'Task tag created' });
});

// Get all task tags function
export const getAllTaskTags = onRequest({ cors: true }, async (request, response) => {
  const tags = await taskModule.getAllTags(request.query.user_id as string);
  response.status(200).json(tags);
});

// Create task category function
export const createTaskCategory = onRequest({ cors: true }, async (request, response) => {
  await taskModule.createCategory(request.query.user_id as string, request.query.category_name as string);
  response.status(200).json({ message: 'Task category created' });
});

// Get all task categories function
export const getAllTaskCategories = onRequest({ cors: true }, async (request, response) => {
  const categories = await taskModule.getAllCategories(request.query.user_id as string);
  response.status(200).json(categories);
});

// Create task list function
export const createTaskList = onRequest({ cors: true }, async (request, response) => {
  const taskId = await taskModule.createTaskList(request.query.user_id as string, request.query.list_name as string);
  response.status(200).json({ task_id: taskId });
});

// Get all task lists function
export const getAllTaskLists = onRequest({ cors: true }, async (request, response) => {
  const lists = await taskModule.getAllTaskLists(request.query.user_id as string);
  const listsJson = JSON.stringify(lists);
  logger.info('lists_json:', listsJson);
  response.status(200).json(lists);
});

// Get tasks by list function
export const getTasksByList = onRequest({ cors: true }, async (request, response) => {
  const tasks = await taskModule.getTasksByList(request.query.user_id as string, request.query.list_id as string);
  const tasksJson = JSON.stringify(tasks);
  logger.info('tasks_json:', tasksJson);
  response.status(200).json(tasks);
});

// Star task function
export const starTask = onRequest({ cors: true }, async (request, response) => {
  logRequest(request);
  const userId = request.query.user_id as string;
  logger.info(`User ID received: ${userId}`);

  await taskModule.starTask(request.query.user_id as string, request.query.list_id as string, request.query.task_id as string);
  response.status(200).json({ message: 'Task starred' });
});

// Unstar task function
export const unstarTask = onRequest({ cors: true }, async (request, response) => {
  logRequest(request);
  const userId = request.query.user_id as string;
  logger.info(`User ID received: ${userId}`);

  await taskModule.unstarTask(request.query.user_id as string, request.query.list_id as string, request.query.task_id as string);
  response.status(200).json({ message: 'Task unstarred' });
});

// Get starred tasks function
export const getStarredTasks = onRequest({ cors: true }, async (request, response) => {
  const tasks = await taskModule.getStarredTasks(request.query.user_id as string);
  const tasksJson = JSON.stringify(tasks);
  logger.info('starred_tasks_json:', tasksJson);
  response.status(200).json(tasks);
});

// Helper function to log requests (same as before)
function logRequest(req: express.Request): void {
  logger.info(`Request method: ${req.method}`);
  logger.info(`Request URL: ${req.url}`);
  logger.info(`Query Parameters: ${JSON.stringify(req.query)}`);
  logger.info(`Request Headers: ${JSON.stringify(req.headers)}`);
}