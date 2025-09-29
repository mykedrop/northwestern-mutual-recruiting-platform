const tf = require('@tensorflow/tfjs-node');
const db = require('../../db');

class SuccessPredictionModel {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        this.modelPath = './models/success_predictor';
    }

    async initialize() {
        try {
            // Try to load existing model
            this.model = await tf.loadLayersModel(`file://${this.modelPath}/model.json`);
            this.isLoaded = true;
            console.log('✅ Success prediction model loaded');
        } catch (error) {
            console.log('⚠️ No existing model found, creating new one');
            await this.createModel();
            await this.trainModel();
        }
    }

    createModel() {
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({
                    inputShape: [150],
                    units: 256,
                    activation: 'relu',
                    kernelInitializer: 'heNormal'
                }),
                tf.layers.dropout({ rate: 0.3 }),
                tf.layers.dense({
                    units: 128,
                    activation: 'relu',
                    kernelInitializer: 'heNormal'
                }),
                tf.layers.dropout({ rate: 0.2 }),
                tf.layers.dense({
                    units: 64,
                    activation: 'relu',
                    kernelInitializer: 'heNormal'
                }),
                tf.layers.dense({
                    units: 1,
                    activation: 'sigmoid'
                })
            ]
        });

        this.model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'binaryCrossentropy',
            metrics: ['accuracy']
        });
    }

    async trainModel() {
        const trainingData = await this.loadTrainingData();
        
        if (!trainingData || trainingData.features.length === 0) {
            console.log('⚠️ No training data available');
            return;
        }

        const features = tf.tensor2d(trainingData.features);
        const labels = tf.tensor2d(trainingData.labels, [trainingData.labels.length, 1]);

        const history = await this.model.fit(features, labels, {
            epochs: 100,
            batchSize: 32,
            validationSplit: 0.2,
            callbacks: {
                onEpochEnd: (epoch, logs) => {
                    if (epoch % 10 === 0) {
                        console.log(`Epoch ${epoch}: loss = ${logs.loss.toFixed(4)}, accuracy = ${logs.acc.toFixed(4)}`);
                    }
                }
            }
        });

        // Save the model
        await this.model.save(`file://${this.modelPath}`);
        this.isLoaded = true;

        // Clean up tensors
        features.dispose();
        labels.dispose();

        return history;
    }

    async loadTrainingData() {
        try {
            const result = await db.query(`
                SELECT 
                    features,
                    labels
                FROM ml_training_data
                WHERE is_training = true
                ORDER BY created_at DESC
                LIMIT 5000
            `);

            if (result.rows.length === 0) {
                return null;
            }

            const features = result.rows.map(row => this.extractFeatures(row.features));
            const labels = result.rows.map(row => row.labels.success ? 1 : 0);

            return { features, labels };
        } catch (error) {
            console.error('Error loading training data:', error);
            return null;
        }
    }

    extractFeatures(rawFeatures) {
        // Convert raw features to numerical array
        // This is a simplified version - extend based on your actual features
        const features = new Array(150).fill(0);
        
        let index = 0;
        
        // Assessment scores (12 dimensions * 5 = 60 features)
        if (rawFeatures.assessmentScores) {
            Object.values(rawFeatures.assessmentScores).forEach(score => {
                if (index < 60) features[index++] = score / 100;
            });
        }
        
        // Experience features (20 features)
        if (rawFeatures.experience) {
            features[60] = Math.min(rawFeatures.experience.years / 20, 1);
            features[61] = rawFeatures.experience.relevantYears / 20;
            features[62] = rawFeatures.experience.numberOfRoles / 10;
            // ... add more experience features
        }
        
        // Skills features (30 features)
        if (rawFeatures.skills) {
            const skillsList = rawFeatures.skills;
            skillsList.forEach((skill, i) => {
                if (i < 30) features[90 + i] = 1;
            });
        }
        
        // Education features (10 features)
        if (rawFeatures.education) {
            features[120] = rawFeatures.education.level / 5; // Normalized education level
            // ... add more education features
        }
        
        // Additional features (30 features)
        // Add location match, culture fit scores, etc.
        
        return features;
    }

    async predict(candidateData) {
        if (!this.isLoaded) {
            throw new Error('Model not loaded');
        }

        const features = this.extractFeatures(candidateData);
        const input = tf.tensor2d([features]);
        
        const prediction = await this.model.predict(input).data();
        
        input.dispose();
        
        return {
            successProbability: prediction[0],
            confidence: Math.abs(prediction[0] - 0.5) * 2, // Convert to confidence score
            recommendation: prediction[0] > 0.7 ? 'strong_hire' : 
                           prediction[0] > 0.5 ? 'hire' :
                           prediction[0] > 0.3 ? 'maybe' : 'no_hire'
        };
    }

    async updateModel(newData) {
        // Incremental learning - retrain with new data
        const features = tf.tensor2d([this.extractFeatures(newData.features)]);
        const label = tf.tensor2d([[newData.label]]);
        
        await this.model.fit(features, label, {
            epochs: 10,
            verbose: 0
        });
        
        features.dispose();
        label.dispose();
        
        // Save updated model
        await this.model.save(`file://${this.modelPath}`);
    }
}

module.exports = new SuccessPredictionModel();

