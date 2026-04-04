import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { authService } from '../../services/authService';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';
import './TutorialModal.css';

const TUTORIAL_STEPS = [
  {
    title: "Welcome to Docketra!",
    content: "This quick tour will show you the major features to help you get started with your new workspace.",
  },
  {
    title: "1. Adding a Client",
    content: "Everything revolves around clients. Start by adding a new client in the 'Clients' section. You'll attach all cases, dockets, and files directly to a client.",
  },
  {
    title: "2. Adding More Users",
    content: "Collaboration is key! Go to the 'Admin' > 'Team Management' section to invite your team members. You can assign different roles like Admin or Employee.",
  },
  {
    title: "3. Adding Case Categories",
    content: "Organize your workflow by creating Case Categories (in Firm Settings). This helps you classify the dockets effectively.",
  },
  {
    title: "4. Creating Your First Docket",
    content: "Use the 'New Docket' button in the top right. A docket is a workspace for a specific compliance task or case associated with your client.",
  },
  {
    title: "5. Using the Workbasket",
    content: "The Workbasket acts as a global queue for unassigned dockets. This is where tasks go when they are created but don't yet have an owner.",
  },
  {
    title: "6. Pulling from Workbasket to Worklist",
    content: "Review the Workbasket, pick a docket, and assign it to yourself. It will then move to your 'My Worklist', giving you full ownership to track deadlines and tasks.",
  },
];

export const TutorialModal = ({ isOpen, onClose }) => {
  const { user, fetchProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleComplete = async () => {
    try {
      setIsLoading(true);
      await authService.updateProfile({ hasCompletedTutorial: true });
      await fetchProfile(); // Refresh context
      onClose();
      showSuccess("Tour completed! Enjoy your workspace.");
    } catch (error) {
      console.error("Failed to complete tutorial", error);
      showError("Failed to update tutorial status.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const step = TUTORIAL_STEPS[currentStep];

  return (
    <Modal isOpen={isOpen} onClose={handleComplete} title="Getting Started Guide">
      <div className="tutorial-modal-content">
        <h3 className="tutorial-step-title">{step.title}</h3>
        <p className="tutorial-step-desc">{step.content}</p>

        <div className="tutorial-progress">
          <div className="tutorial-progress-bar" style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}></div>
        </div>

        <div className="tutorial-modal-actions">
          <Button variant="secondary" onClick={handleComplete} disabled={isLoading}>
            Skip Tour
          </Button>
          <div className="tutorial-nav-buttons">
            <Button variant="outline" onClick={handlePrev} disabled={currentStep === 0 || isLoading}>
              Previous
            </Button>
            <Button variant="primary" onClick={handleNext} disabled={isLoading}>
              {currentStep === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
