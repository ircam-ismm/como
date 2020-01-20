import Input from './Input.js';
import InputResampler from './InputResampler.js';

import AudioDestination from './AudioDestination.js';
import MotionDescriptors from './MotionDescriptors.js';
import ExampleRecorder from './ExampleRecorder.js';
import NetworkSend from './NetworkSend.js';
import MLDecoder from './MLDecoder.js';
import Merge from './Merge.js';
import StreamRecorder from './StreamRecorder.js';

// scripts
import ScriptAudio from './ScriptAudio.js';
import ScriptData from './ScriptData.js';

import Logger from './Logger.js';

export default [
  Input,
  InputResampler,

  MotionDescriptors,
  ExampleRecorder,
  MLDecoder,

  Merge,

  ScriptAudio,
  ScriptData,

  AudioDestination,
  NetworkSend,

  Logger,
  StreamRecorder,
];
