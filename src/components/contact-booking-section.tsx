import React, { useState } from 'react';
import type { AutomatedCourseDetails } from '../types/quality.types';

interface ContactBookingSectionProps {
  course: AutomatedCourseDetails;
}

/**
 * Contact & Booking Section Component
 *
 * Displays contact information and booking options including:
 * - Primary contact details (phone, website, address)
 * - Tee time booking integration
 * - Operating hours and policies
 * - Social media links
 * - Contact form for inquiries
 */
export const ContactBookingSection: React.FC<ContactBookingSectionProps> = ({
  course
}) => {
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
    preferredDate: '',
    groupSize: '1'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setContactForm(prev => ({ ...prev, [name]: value }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // In a real implementation, this would send the form data to an API
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setSubmitStatus('success');
      setContactForm({
        name: '',
        email: '',
        phone: '',
        message: '',
        preferredDate: '',
        groupSize: '1'
      });
    } catch (error) {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="py-12 md:py-16 bg-gray-900 text-white">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">

          {/* Section Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Contact & Booking
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Ready to play {course.name}? Get in touch to book your tee time or ask any questions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

            {/* Contact Information */}
            <div>
              <h3 className="text-2xl font-semibold mb-8">Get In Touch</h3>

              {/* Primary Contact */}
              <div className="space-y-6 mb-8">
                {course.phoneNumber && (
                  <div className="flex items-center">
                    <div className="bg-green-600 rounded-full p-3 mr-4 flex-shrink-0">
                      <span className="text-white text-xl">📞</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">Phone</h4>
                      <a
                        href={`tel:${course.phoneNumber}`}
                        className="text-green-400 hover:text-green-300 transition-colors text-lg"
                      >
                        {course.phoneNumber}
                      </a>
                      <p className="text-gray-400 text-sm mt-1">
                        Call for tee times and course information
                      </p>
                    </div>
                  </div>
                )}

                {course.website && (
                  <div className="flex items-center">
                    <div className="bg-blue-600 rounded-full p-3 mr-4 flex-shrink-0">
                      <span className="text-white text-xl">🌐</span>
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">Website</h4>
                      <a
                        href={course.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors text-lg"
                      >
                        Visit Official Website
                      </a>
                      <p className="text-gray-400 text-sm mt-1">
                        Course information and online booking
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start">
                  <div className="bg-red-600 rounded-full p-3 mr-4 flex-shrink-0">
                    <span className="text-white text-xl">📍</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-lg">Address</h4>
                    <p className="text-gray-300 text-lg">{course.location}</p>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(course.location || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red-400 hover:text-red-300 transition-colors text-sm mt-1 inline-block"
                    >
                      Get Directions →
                    </a>
                  </div>
                </div>
              </div>

              {/* Booking Information */}
              <div className="bg-gray-800 rounded-xl p-6">
                <h4 className="text-xl font-semibold mb-4">Booking Information</h4>
                <div className="space-y-3">
                  {course.greensFeePriceRange && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Greens Fee:</span>
                      <span className="text-green-400 font-semibold">{course.greensFeePriceRange}</span>
                    </div>
                  )}
                  {course.cartRequired !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Cart:</span>
                      <span className="text-white">{course.cartRequired ? 'Required' : 'Optional'}</span>
                    </div>
                  )}
                  {course.publicAccess !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-300">Access:</span>
                      <span className="text-white">{course.publicAccess ? 'Public' : 'Private'}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-700">
                    <p className="text-gray-400 text-sm">
                      * Prices and availability subject to change. Please call or visit the website for current rates and booking.
                    </p>
                  </div>
                </div>
              </div>

              {/* Primary Booking Button */}
              {course.teeTimeBookingUrl && (
                <div className="mt-8">
                  <a
                    href={course.teeTimeBookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full bg-green-600 hover:bg-green-700 text-white text-center font-bold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    <span className="text-xl mr-2">⛳</span>
                    Book Your Tee Time Now
                  </a>
                </div>
              )}
            </div>

            {/* Contact Form */}
            <div>
              <h3 className="text-2xl font-semibold mb-8">Send Us a Message</h3>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={contactForm.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                      placeholder="Your full name"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={contactForm.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                      placeholder="your.email@example.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={contactForm.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label htmlFor="groupSize" className="block text-sm font-medium text-gray-300 mb-2">
                      Group Size
                    </label>
                    <select
                      id="groupSize"
                      name="groupSize"
                      value={contactForm.groupSize}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                    >
                      <option value="1">1 Person</option>
                      <option value="2">2 People</option>
                      <option value="3">3 People</option>
                      <option value="4">4 People</option>
                      <option value="5+">5+ People</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="preferredDate" className="block text-sm font-medium text-gray-300 mb-2">
                    Preferred Date
                  </label>
                  <input
                    type="date"
                    id="preferredDate"
                    name="preferredDate"
                    value={contactForm.preferredDate}
                    onChange={handleInputChange}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={contactForm.message}
                    onChange={handleInputChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-colors resize-vertical"
                    placeholder="Tell us about your visit, any special requests, or questions you have..."
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-semibold py-4 px-6 rounded-lg transition-colors disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Sending Message...
                    </span>
                  ) : (
                    'Send Message'
                  )}
                </button>

                {/* Submit Status Messages */}
                {submitStatus === 'success' && (
                  <div className="bg-green-600 text-white p-4 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-xl mr-2">✅</span>
                      <div>
                        <h4 className="font-semibold">Message Sent Successfully!</h4>
                        <p className="text-sm">We'll get back to you within 24 hours.</p>
                      </div>
                    </div>
                  </div>
                )}

                {submitStatus === 'error' && (
                  <div className="bg-red-600 text-white p-4 rounded-lg">
                    <div className="flex items-center">
                      <span className="text-xl mr-2">❌</span>
                      <div>
                        <h4 className="font-semibold">Error Sending Message</h4>
                        <p className="text-sm">Please try again or call us directly.</p>
                      </div>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Footer Note */}
          <div className="mt-12 text-center border-t border-gray-700 pt-8">
            <p className="text-gray-400">
              For immediate assistance or last-minute bookings, please call us directly at{' '}
              {course.phoneNumber && (
                <a href={`tel:${course.phoneNumber}`} className="text-green-400 hover:text-green-300">
                  {course.phoneNumber}
                </a>
              )}
              {!course.phoneNumber && 'the course'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};