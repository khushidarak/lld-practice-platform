import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DesignForm } from './DesignForm'
import type { SubmissionContent } from '../types'

describe('DesignForm validation', () => {
  it('validates all required fields are present', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<DesignForm onSubmit={onSubmit} submitting={false} formError={null} />)

    const submitButton = screen.getByRole('button', { name: /submit design/i })
    await user.click(submitButton)

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('accepts valid submission', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<DesignForm onSubmit={onSubmit} submitting={false} formError={null} />)

    await user.type(
      screen.getByLabelText(/assumptions/i),
      'One vehicle per spot',
    )
    await user.type(
      screen.getByLabelText(/relationships/i),
      'ParkingLot has multiple Floors',
    )
    await user.type(
      screen.getByLabelText(/key flow/i),
      'Vehicle arrives -> find spot -> issue ticket',
    )
    await user.type(
      screen.getByLabelText(/trade-offs/i),
      'Simple vs flexible design',
    )

    // Fill in class row
    await user.type(screen.getByLabelText(/name/i), 'ParkingLot')
    await user.type(
      screen.getByLabelText(/responsibility/i),
      'Manages the entire garage',
    )
    await user.type(
      screen.getByLabelText(/key methods/i),
      'findSpot, issueTicket',
    )

    const submitButton = screen.getByRole('button', { name: /submit design/i })
    await user.click(submitButton)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const submittedContent = onSubmit.mock.calls[0][0] as SubmissionContent
    expect(submittedContent.assumptions).toBe('One vehicle per spot')
    expect(submittedContent.classes).toHaveLength(1)
    expect(submittedContent.classes[0].name).toBe('ParkingLot')
  })

  it('validates class rows with partial data', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<DesignForm onSubmit={onSubmit} submitting={false} formError={null} />)

    // Fill required fields
    await user.type(
      screen.getByLabelText(/assumptions/i),
      'Some assumptions',
    )
    await user.type(
      screen.getByLabelText(/relationships/i),
      'Some relationships',
    )
    await user.type(
      screen.getByLabelText(/key flow/i),
      'Some flow',
    )
    await user.type(
      screen.getByLabelText(/trade-offs/i),
      'Some tradeoffs',
    )

    // Fill only class name, not responsibility or methods
    await user.type(screen.getAllByLabelText(/name/i)[0], 'IncompleteClass')

    const submitButton = screen.getByRole('button', { name: /submit design/i })
    await user.click(submitButton)

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits when only complete class rows are included', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<DesignForm onSubmit={onSubmit} submitting={false} formError={null} />)

    // Fill required fields
    await user.type(
      screen.getByLabelText(/assumptions/i),
      'Some assumptions',
    )
    await user.type(
      screen.getByLabelText(/relationships/i),
      'Some relationships',
    )
    await user.type(
      screen.getByLabelText(/key flow/i),
      'Some flow',
    )
    await user.type(
      screen.getByLabelText(/trade-offs/i),
      'Some tradeoffs',
    )

    // Fill first row completely
    await user.type(screen.getAllByLabelText(/name/i)[0], 'CompleteClass')
    await user.type(
      screen.getAllByLabelText(/responsibility/i)[0],
      'Some responsibility',
    )
    await user.type(
      screen.getAllByLabelText(/key methods/i)[0],
      'method1, method2',
    )

    // Add second row but leave it empty
    const addButton = screen.getByRole('button', { name: /add type/i })
    await user.click(addButton)

    const submitButton = screen.getByRole('button', { name: /submit design/i })
    await user.click(submitButton)

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const submittedContent = onSubmit.mock.calls[0][0] as SubmissionContent
    expect(submittedContent.classes).toHaveLength(1)
    expect(submittedContent.classes[0].name).toBe('CompleteClass')
  })

  it('trims whitespace from submitted content', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<DesignForm onSubmit={onSubmit} submitting={false} formError={null} />)

    await user.type(
      screen.getByLabelText(/assumptions/i),
      '  Some assumptions  ',
    )
    await user.type(
      screen.getByLabelText(/relationships/i),
      '  Some relationships  ',
    )
    await user.type(
      screen.getByLabelText(/key flow/i),
      '  Some flow  ',
    )
    await user.type(
      screen.getByLabelText(/trade-offs/i),
      '  Some tradeoffs  ',
    )

    await user.type(screen.getAllByLabelText(/name/i)[0], '  TestClass  ')
    await user.type(
      screen.getAllByLabelText(/responsibility/i)[0],
      '  Some responsibility  ',
    )
    await user.type(
      screen.getAllByLabelText(/key methods/i)[0],
      '  method1 , method2  ',
    )

    const submitButton = screen.getByRole('button', { name: /submit design/i })
    await user.click(submitButton)

    const submittedContent = onSubmit.mock.calls[0][0] as SubmissionContent
    expect(submittedContent.assumptions).toBe('Some assumptions')
    expect(submittedContent.classes[0].name).toBe('TestClass')
    expect(submittedContent.classes[0].keyMethods).toEqual(['method1', 'method2'])
  })

  it('splits comma-separated methods into array', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<DesignForm onSubmit={onSubmit} submitting={false} formError={null} />)

    // Fill required fields
    await user.type(
      screen.getByLabelText(/assumptions/i),
      'Some assumptions',
    )
    await user.type(
      screen.getByLabelText(/relationships/i),
      'Some relationships',
    )
    await user.type(
      screen.getByLabelText(/key flow/i),
      'Some flow',
    )
    await user.type(
      screen.getByLabelText(/trade-offs/i),
      'Some tradeoffs',
    )

    await user.type(screen.getAllByLabelText(/name/i)[0], 'TestClass')
    await user.type(
      screen.getAllByLabelText(/responsibility/i)[0],
      'Some responsibility',
    )
    await user.type(
      screen.getAllByLabelText(/key methods/i)[0],
      'method1, method2, method3',
    )

    const submitButton = screen.getByRole('button', { name: /submit design/i })
    await user.click(submitButton)

    const submittedContent = onSubmit.mock.calls[0][0] as SubmissionContent
    expect(submittedContent.classes[0].keyMethods).toEqual([
      'method1',
      'method2',
      'method3',
    ])
  })

  it('filters empty method names', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(<DesignForm onSubmit={onSubmit} submitting={false} formError={null} />)

    // Fill required fields
    await user.type(
      screen.getByLabelText(/assumptions/i),
      'Some assumptions',
    )
    await user.type(
      screen.getByLabelText(/relationships/i),
      'Some relationships',
    )
    await user.type(
      screen.getByLabelText(/key flow/i),
      'Some flow',
    )
    await user.type(
      screen.getByLabelText(/trade-offs/i),
      'Some tradeoffs',
    )

    await user.type(screen.getAllByLabelText(/name/i)[0], 'TestClass')
    await user.type(
      screen.getAllByLabelText(/responsibility/i)[0],
      'Some responsibility',
    )
    await user.type(
      screen.getAllByLabelText(/key methods/i)[0],
      'method1, , method3',
    )

    const submitButton = screen.getByRole('button', { name: /submit design/i })
    await user.click(submitButton)

    const submittedContent = onSubmit.mock.calls[0][0] as SubmissionContent
    expect(submittedContent.classes[0].keyMethods).toEqual(['method1', 'method3'])
  })

  it('disables submit button while submitting', () => {
    const onSubmit = vi.fn()

    render(<DesignForm onSubmit={onSubmit} submitting={true} formError={null} />)

    const submitButton = screen.getByRole('button', { name: /submitting/i })
    expect(submitButton).toBeDisabled()
  })

  it('displays form error when provided', () => {
    const onSubmit = vi.fn()

    render(
      <DesignForm
        onSubmit={onSubmit}
        submitting={false}
        formError="Something went wrong"
      />,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })
})
